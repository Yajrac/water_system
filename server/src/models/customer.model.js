import { pool } from '../database/pool.js';

const joins = `
  FROM customers c
  JOIN barangays b ON b.id = c.barangay_id
  LEFT JOIN users u ON u.id = c.user_id
  LEFT JOIN customer_applications a ON a.id = (
    SELECT MAX(ca.id) FROM customer_applications ca WHERE ca.customer_id = c.id
  )
  LEFT JOIN users approver ON approver.id = a.approved_by
  LEFT JOIN application_documents d ON d.application_id = a.id
  LEFT JOIN application_estimates e ON e.application_id = a.id
  LEFT JOIN water_meters m ON m.id = (
    SELECT MAX(wm.id) FROM water_meters wm WHERE wm.customer_id = c.id AND wm.is_active = 1
  )
`;
const projection = `
  c.id, c.user_id AS userId, c.barangay_id AS barangayId,
  c.account_number AS account, c.submitter_number AS submitterNumber,
  c.first_name AS firstName, c.middle_name AS middleName, c.last_name AS lastName,
  c.extension_name AS extensionName, c.gender, c.contact_number AS contact,
  c.purok AS address, c.street, c.customer_type AS customerType,
  c.connection_status AS connectionStatus, b.name AS barangay,
  u.username,
  SHA2(CONCAT_WS('|', u.password_hash, u.role, u.is_active), 256) AS _credentialRevision,
  a.id AS applicationId, a.application_number AS applicationNumber,
  a.nature_of_work AS natureOfWork, a.status AS serviceStatus,
  DATE_FORMAT(a.date_applied, '%Y-%m-%d') AS dateApplied,
  DATE_FORMAT(a.date_approved, '%Y-%m-%d') AS dateApproved,
  a.approved_by AS approverId, approver.username AS approvedBy,
  m.id AS meterId, m.meter_number AS meterNumber, m.meter_kind AS meterKind,
  m.meter_size AS meterSize, m.current_reading AS reading, m.initial_reading AS initialReading,
  DATE_FORMAT(m.date_installed, '%Y-%m-%d') AS dateInstalled,
  d.id AS documentsId, e.id AS estimatesId,
  d.certificate_received AS certificateReceived, d.contract_received AS contractReceived,
  d.acknowledgement_received AS acknowledgementReceived,
  DATE_FORMAT(d.contract_signed_date, '%Y-%m-%d') AS contractDate,
  DATE_FORMAT(d.acknowledgement_date, '%Y-%m-%d') AS acknowledgementDate,
  d.ctc_number AS ctcNumber, DATE_FORMAT(d.ctc_issued_date, '%Y-%m-%d') AS ctcDate,
  d.ctc_issued_place AS ctcPlace, d.representative_ctc_number AS representativeCtc,
  DATE_FORMAT(d.representative_ctc_issued_date, '%Y-%m-%d') AS representativeCtcDate,
  d.representative_ctc_issued_place AS representativeCtcPlace, d.notes AS documentNotes,
  e.installation_fee AS installationFee, e.setback_length AS setbackLength,
  e.setback_rate AS setbackRate, e.reinstallation_fee AS reinstallationFee,
  e.violation_fee AS violationFee,
  EXISTS(SELECT 1 FROM bills cb WHERE cb.customer_id = c.id) AS hasBills,
  EXISTS(SELECT 1 FROM meter_entries me WHERE me.meter_id = m.id) AS hasMeterEntries,
  CAST(c.updated_at AS CHAR) AS updatedAt
`;

export async function findCustomer(id, connection = pool, lock = false) {
  if (lock) {
    const [locked] = await connection.execute('SELECT id FROM customers WHERE id = ? FOR UPDATE', [
      id,
    ]);
    if (!locked.length) return null;
  }
  const [rows] = await connection.execute('SELECT ' + projection + joins + ' WHERE c.id = ?', [id]);
  return rows[0] || null;
}

export async function listCustomers(filters) {
  const conditions = [],
    values = [];
  if (filters.search) {
    conditions.push(
      "(CONCAT_WS(' ', c.first_name, c.middle_name, c.last_name, c.extension_name) LIKE ? OR c.account_number LIKE ? OR c.submitter_number LIKE ?)",
    );
    values.push(...Array(3).fill('%' + filters.search + '%'));
  }
  if (filters.barangayId) {
    conditions.push('c.barangay_id = ?');
    values.push(filters.barangayId);
  }
  if (filters.type) {
    conditions.push('c.customer_type = ?');
    values.push(filters.type);
  }
  if (filters.status === 'inactive') conditions.push("c.connection_status <> 'Active'");
  if (filters.status === 'registered')
    conditions.push("COALESCE(a.status, 'Pending') <> 'Pending'");
  if (filters.status === 'pending') conditions.push("COALESCE(a.status, 'Pending') = 'Pending'");
  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const [[count]] = await pool.execute('SELECT COUNT(*) AS total ' + joins + where, values);
  const total = Number(count.total);
  const page = Math.min(filters.page, Math.max(1, Math.ceil(total / filters.limit)));
  const [rows] = await pool.execute(
    'SELECT ' +
      projection +
      joins +
      where +
      ' ORDER BY c.last_name ASC, c.first_name ASC, c.middle_name ASC, c.extension_name ASC, c.id ASC LIMIT ? OFFSET ?',
    [...values, filters.limit, (page - 1) * filters.limit],
  );
  const [[summary]] = await pool.execute(
    `SELECT COUNT(*) AS total,
    COALESCE(SUM(COALESCE(a.status, 'Pending') <> 'Pending'), 0) AS registered,
    COALESCE(SUM(COALESCE(a.status, 'Pending') = 'Pending'), 0) AS pending` + joins,
  );
  return {
    rows,
    pagination: {
      page,
      limit: filters.limit,
      total,
      pages: Math.max(1, Math.ceil(total / filters.limit)),
    },
    summary: Object.fromEntries(
      Object.entries(summary).map(([key, value]) => [key, Number(value)]),
    ),
  };
}

// Identifiers are restricted to this server-owned list; values remain placeholders.
const writable = {
  customers: [
    'user_id',
    'barangay_id',
    'account_number',
    'submitter_number',
    'first_name',
    'middle_name',
    'last_name',
    'extension_name',
    'gender',
    'contact_number',
    'purok',
    'street',
    'customer_type',
    'connection_status',
  ],
  customer_applications: [
    'customer_id',
    'application_number',
    'nature_of_work',
    'status',
    'date_applied',
    'date_approved',
    'approved_by',
  ],
  application_documents: [
    'application_id',
    'certificate_received',
    'contract_received',
    'acknowledgement_received',
    'contract_signed_date',
    'acknowledgement_date',
    'ctc_number',
    'ctc_issued_date',
    'ctc_issued_place',
    'representative_ctc_number',
    'representative_ctc_issued_date',
    'representative_ctc_issued_place',
    'notes',
  ],
  application_estimates: [
    'application_id',
    'installation_fee',
    'setback_length',
    'setback_rate',
    'reinstallation_fee',
    'violation_fee',
  ],
  water_meters: [
    'customer_id',
    'application_id',
    'meter_number',
    'meter_kind',
    'meter_size',
    'initial_reading',
    'current_reading',
    'date_installed',
    'is_active',
  ],
  users: ['username', 'password_hash', 'role', 'is_active'],
};
export async function writeRecord(table, record, connection, id = null) {
  const columns = Object.keys(record);
  if (!writable[table] || !columns.length || columns.some((key) => !writable[table].includes(key)))
    throw new Error('Invalid internal write mapping.');
  const values = columns.map((key) => record[key]);
  const sql =
    id === null
      ? 'INSERT INTO ' +
        table +
        ' (' +
        columns.join(', ') +
        ') VALUES (' +
        columns.map(() => '?').join(', ') +
        ')'
      : 'UPDATE ' +
        table +
        ' SET ' +
        columns.map((key) => key + ' = ?').join(', ') +
        ' WHERE id = ?';
  const [result] = await connection.execute(sql, id === null ? values : [...values, id]);
  return id ?? String(result.insertId);
}

export async function lockBarangay(id, connection) {
  const [[row]] = await connection.execute(
    'SELECT id, is_active FROM barangays WHERE id = ? LOCK IN SHARE MODE',
    [id],
  );
  return row || null;
}

export async function customerFinancials(id) {
  const [bills] = await pool.execute(
    `SELECT id, customer_id AS customerId,
    DATE_FORMAT(billing_month, '%Y-%m') AS cycle, DATE_FORMAT(due_date, '%Y-%m-%d') AS due,
    previous_reading AS previous, current_reading AS current, consumption,
    rate_per_cubic_meter AS ratePerCubic, water_charge AS water,
    connection_charge AS connection, late_fee AS late, other_charge AS other, total_amount AS total
    FROM bills WHERE customer_id = ? ORDER BY billing_month DESC`,
    [id],
  );
  const [payments] = await pool.execute(
    `SELECT p.id, b.customer_id AS customerId, p.bill_id AS billId,
    p.receipt_number AS receipt, p.amount, p.payment_method AS method,
    DATE_FORMAT(CONVERT_TZ(p.paid_at, '+00:00', '+08:00'), '%Y-%m-%d') AS date, p.remarks
    FROM payments p JOIN bills b ON b.id = p.bill_id WHERE b.customer_id = ? ORDER BY p.paid_at DESC, p.id DESC`,
    [id],
  );
  return { bills, payments };
}

export async function logActivity(connection, actorId, action, customerId, description) {
  await connection.execute(
    `INSERT INTO activity_logs
    (actor_id, actor_role, action, entity_type, entity_id, description)
    VALUES (?, 'admin', ?, 'customer', ?, ?)`,
    [actorId, action, customerId, description],
  );
}
export async function logConnection(connection, id, actorId, previousStatus, newStatus, reason) {
  await connection.execute(
    `INSERT INTO connection_events
    (customer_id, performed_by, previous_status, new_status, reason, effective_at)
    VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
    [id, actorId, previousStatus, newStatus, reason],
  );
}
