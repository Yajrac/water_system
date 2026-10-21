import { createHash } from 'node:crypto';
import { pool } from '../database/pool.js';
import { AppError } from '../utils/app-error.js';
import { validateCustomer } from '../validators/customer.validator.js';
import { resolveImportBarangay } from '../validators/barangay.validator.js';
import { findImportBarangay } from './customer-import-barangays.js';

export function checkImportRows(body) {
  if (!Array.isArray(body?.customers) || !body.customers.length || body.customers.length > 100)
    throw new AppError('Import between 1 and 100 customers at a time.', 400);
  return body.customers;
}

export async function reviewCustomerImport(body, connection = pool, lock = false) {
  const source = checkImportRows(body),
    rows = [],
    entries = [],
    names = new Set(),
    seen = new Set();
  for (const [index, item] of source.entries()) {
    const row = {
      index,
      row: index + 2,
      account: typeof item?.account === 'string' ? item.account : '',
      name: [item?.firstName, item?.middleName, item?.lastName, item?.extensionName]
        .filter((value) => typeof value === 'string')
        .join(' ')
        .slice(0, 240),
      status: 'ready',
      reason: '',
    };
    try {
      if (!item || typeof item !== 'object' || Array.isArray(item))
        throw new AppError('Invalid customer fields.', 400);
      if (item.username || item.password)
        throw new AppError('Assign app credentials individually after import.', 400);
      if (!item.account) throw new AppError('Account number is required.', 400);
      const details = validateCustomer(item, { importing: true });
      const account = details.account.toLowerCase();
      if (seen.has(account))
        throw new AppError('Duplicate account number within this Excel file.', 409);
      seen.add(account);
      const [existing] = await connection.execute(
        'SELECT id FROM customers WHERE account_number = ?' + (lock ? ' FOR UPDATE' : ''),
        [details.account],
      );
      if (existing.length)
        throw new AppError('Customer already exists: account ' + details.account + '.', 409);
      let missing = null;
      if (details.barangayName) {
        const area = resolveImportBarangay(details.barangayName);
        if (!(await findImportBarangay(area, connection, lock))) missing = area.name;
      } else {
        const [areas] = await connection.execute(
          'SELECT id, is_active FROM barangays WHERE id = ?' + (lock ? ' FOR UPDATE' : ''),
          [details.barangayId],
        );
        if (!areas[0] || Number(areas[0].is_active) !== 1)
          throw new AppError('Barangay is missing or inactive.', 409);
      }
      if (missing) names.add(missing);
      entries.push(details);
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      row.status = 'rejected';
      row.reason = error.message;
    }
    rows.push(row);
  }
  const barangaysToRegister = [...names].sort();
  const revision = createHash('sha256')
    .update(JSON.stringify({ source, rows, barangaysToRegister }))
    .digest('hex');
  return {
    entries,
    preview: {
      rows,
      count: entries.length,
      rejectedCount: rows.length - entries.length,
      barangaysToRegister,
      revision,
    },
  };
}
