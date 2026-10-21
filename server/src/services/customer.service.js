import { randomBytes } from 'node:crypto';
import { pool } from '../database/pool.js';
import * as model from '../models/customer.model.js';
import { hashPassword } from '../utils/password.js';
import { AppError } from '../utils/app-error.js';
import {
  customerId,
  today,
  validateCustomer,
  validateCustomerQuery,
} from '../validators/customer.validator.js';
import { customerView, financialView } from './customer-mapper.js';
import { reviewCustomerImport } from './customer-import-review.js';
import { registerImportBarangays } from './customer-import-barangays.js';

const optional = (value) => value || null;

async function writeApplication(
  connection,
  details,
  actorId,
  existing = null,
  preparedHash = null,
) {
  const barangay = await model.lockBarangay(details.barangayId, connection);
  if (
    !barangay ||
    (Number(barangay.is_active) !== 1 && existing?.barangayId !== details.barangayId)
  ) {
    throw new AppError('Select an active registered barangay.', 400);
  }
  let userId = existing?.userId || null;
  if (userId) {
    const [[user]] = await connection.execute('SELECT role FROM users WHERE id = ? FOR UPDATE', [
      userId,
    ]);
    if (user?.role !== 'consumer')
      throw new AppError('This customer has an invalid linked login account.', 409);
    await model.writeRecord(
      'users',
      { username: details.username, ...(preparedHash ? { password_hash: preparedHash } : {}) },
      connection,
      userId,
    );
  } else if (details.username) {
    userId = await model.writeRecord(
      'users',
      { username: details.username, password_hash: preparedHash, role: 'consumer', is_active: 1 },
      connection,
    );
  }
  if (
    existing?.hasBills &&
    (existing.barangayId !== details.barangayId || existing.customerType !== details.customerType)
  ) {
    throw new AppError(
      'A billed account cannot change barangay or customer type through this form.',
      409,
    );
  }
  if (existing?.active && details.serviceStatus !== 'Installed') {
    throw new AppError(
      'Deactivate the installed connection before changing its service status.',
      409,
    );
  }
  const suffix = randomBytes(6).toString('hex').toUpperCase();
  const connectionStatus =
    existing?.connectionStatus || (details.serviceStatus === 'Installed' ? 'Active' : 'Inactive');
  const id = await model.writeRecord(
    'customers',
    {
      user_id: userId,
      barangay_id: details.barangayId,
      ...(!existing
        ? {
            account_number: details.account || 'PWSS-' + today().slice(0, 4) + '-' + suffix,
            submitter_number: 'PWSS-' + today().replaceAll('-', '') + '-' + suffix,
          }
        : {}),
      first_name: details.firstName,
      middle_name: optional(details.middleName),
      last_name: details.lastName,
      extension_name: optional(details.extensionName),
      gender: details.gender,
      contact_number: details.contact,
      purok: details.address,
      street: optional(details.street),
      customer_type: details.customerType,
      connection_status: connectionStatus,
    },
    connection,
    existing?.id || null,
  );
  const applicationId = await model.writeRecord(
    'customer_applications',
    {
      customer_id: id,
      ...(!existing?.applicationId
        ? { application_number: 'APP-' + today().slice(0, 4) + '-' + suffix }
        : {}),
      nature_of_work: details.natureOfWork,
      status: details.serviceStatus,
      date_applied: details.dateApplied,
      date_approved: optional(details.dateApproved),
      approved_by: details.serviceStatus === 'Pending' ? null : existing?.approverId || actorId,
    },
    connection,
    existing?.applicationId || null,
  );
  await model.writeRecord(
    'application_documents',
    {
      application_id: applicationId,
      certificate_received: details.certificateReceived,
      contract_received: details.contractReceived,
      acknowledgement_received: details.acknowledgementReceived,
      contract_signed_date: optional(details.contractDate),
      acknowledgement_date: optional(details.acknowledgementDate),
      ctc_number: optional(details.ctcNumber),
      ctc_issued_date: optional(details.ctcDate),
      ctc_issued_place: optional(details.ctcPlace),
      representative_ctc_number: optional(details.representativeCtc),
      representative_ctc_issued_date: optional(details.representativeCtcDate),
      representative_ctc_issued_place: optional(details.representativeCtcPlace),
      notes: optional(details.documentNotes),
    },
    connection,
    existing?.documentsId || null,
  );
  await model.writeRecord(
    'application_estimates',
    {
      application_id: applicationId,
      installation_fee: details.installationFee,
      setback_length: details.setbackLength,
      setback_rate: details.setbackRate,
      reinstallation_fee: details.reinstallationFee,
      violation_fee: details.violationFee,
    },
    connection,
    existing?.estimatesId || null,
  );
  if (existing?.meterId && !details.meterNumber)
    throw new AppError('An installed meter cannot be removed through this form.', 409);
  if (existing?.hasMeterEntries || existing?.hasBills) {
    if (
      details.meterNumber !== existing.meterNumber ||
      Number(details.reading) !== existing.reading ||
      details.dateInstalled !== existing.dateInstalled
    ) {
      throw new AppError(
        'This meter has billing entries. Update readings through Meter Entry; use a separate meter replacement workflow.',
        409,
      );
    }
  }
  if (details.meterNumber) {
    await model.writeRecord(
      'water_meters',
      {
        customer_id: id,
        application_id: applicationId,
        meter_number: details.meterNumber,
        meter_kind: optional(details.meterKind),
        meter_size: optional(details.meterSize),
        ...(!existing?.meterId ? { initial_reading: details.reading } : {}),
        current_reading: details.reading,
        date_installed: details.dateInstalled,
        is_active: 1,
      },
      connection,
      existing?.meterId || null,
    );
  }
  await model.logActivity(
    connection,
    actorId,
    existing ? 'customer.updated' : 'customer.created',
    id,
    existing ? 'Customer application updated.' : 'Customer application registered.',
  );
  return customerView(await model.findCustomer(id, connection));
}

async function transaction(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY')
      throw new AppError('Username, account reference or meter number is already registered.', 409);
    if (error.code === 'ER_LOCK_DEADLOCK' || error.code === 'ER_LOCK_WAIT_TIMEOUT') {
      throw new AppError('Another request changed these records. Reload and try again.', 409);
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function getCustomers(query) {
  const result = await model.listCustomers(validateCustomerQuery(query));
  return {
    customers: result.rows.map(customerView),
    pagination: result.pagination,
    summary: result.summary,
  };
}

export async function getCustomer(id) {
  customerId(id);
  const customer = customerView(await model.findCustomer(id));
  if (!customer) throw new AppError('Customer not found.', 404);
  return { customer, ...financialView(await model.customerFinancials(id)) };
}

export async function saveCustomer(body, actorId, id = null) {
  if (id !== null) customerId(id);
  const existing = id ? customerView(await model.findCustomer(id)) : null;
  if (id && !existing) throw new AppError('Customer not found.', 404);
  const details = validateCustomer(body, { existing });
  const preparedHash = details.password ? await hashPassword(details.password) : null;
  return transaction(async (connection) => {
    const locked = id ? customerView(await model.findCustomer(id, connection, true)) : null;
    if (id && !locked) throw new AppError('Customer not found.', 404);
    if (locked && locked.revision !== body.revision)
      throw new AppError('Customer changed while you were editing. Reload before saving.', 409);
    return writeApplication(
      connection,
      validateCustomer(body, { existing: locked }),
      actorId,
      locked,
      preparedHash,
    );
  });
}

function prepareCustomerImport(body) {
  if (!Array.isArray(body?.customers) || !body.customers.length || body.customers.length > 100) {
    throw new AppError('Import between 1 and 100 customers at a time.', 400);
  }
  return body.customers.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item))
      throw new AppError('Each import row must contain customer fields.', 400);
    if (item.username || item.password)
      throw new AppError('Provision app credentials individually after import.', 400);
    if (!item.account)
      throw new AppError('Each import row must provide its existing account number.', 400);
    return validateCustomer(item, { importing: true });
  });
}

export async function previewCustomerImport(body) {
  return (await reviewCustomerImport(body)).preview;
}

export async function importCustomers(body, actorId) {
  const partial = body?.reviewRevision !== undefined;
  const originalEntries = partial ? null : prepareCustomerImport(body);
  return transaction(async (connection) => {
    let entries = originalEntries,
      rejectedRows = [];
    if (partial) {
      const review = await reviewCustomerImport(body, connection, true);
      if (review.preview.revision !== body.reviewRevision)
        throw new AppError(
          'Import records changed. Check the Excel file again before saving.',
          409,
        );
      entries = review.entries;
      rejectedRows = review.preview.rows.filter((row) => row.status === 'rejected');
      if (!entries.length) throw new AppError('No valid customer rows to import.', 400);
    }
    const areas = await registerImportBarangays(entries, actorId, connection);
    const customers = [];
    for (const details of entries) {
      if (details.barangayName) details.barangayId = areas.ids.get(details.barangayName);
      customers.push(await writeApplication(connection, details, actorId));
    }
    return {
      count: customers.length,
      barangaysRegistered: areas.registered,
      rejectedCount: rejectedRows.length,
      rejectedRows,
    };
  });
}

export async function changeCustomerStatus(id, body, actorId) {
  customerId(id);
  if (
    !body ||
    !['Active', 'Inactive'].includes(body.status) ||
    typeof body.reason !== 'string' ||
    !body.reason.trim() ||
    body.reason.length > 500
  ) {
    throw new AppError('Provide an Active/Inactive status and a reason.', 400);
  }
  return transaction(async (connection) => {
    const existing = customerView(await model.findCustomer(id, connection, true));
    if (!existing) throw new AppError('Customer not found.', 404);
    if (body.revision !== existing.revision)
      throw new AppError('Customer status changed. Reload before trying again.', 409);
    if (body.status === 'Active' && (existing.serviceStatus !== 'Installed' || !existing.meterId)) {
      throw new AppError('Complete installation and meter details before activation.', 409);
    }
    if (existing.connectionStatus !== body.status) {
      await model.writeRecord('customers', { connection_status: body.status }, connection, id);
      await model.logConnection(
        connection,
        id,
        actorId,
        existing.connectionStatus,
        body.status,
        body.reason.trim(),
      );
      await model.logActivity(
        connection,
        actorId,
        'customer.status_changed',
        id,
        body.status + ': ' + body.reason.trim(),
      );
    }
    return customerView(await model.findCustomer(id, connection));
  });
}
