import { randomBytes } from 'node:crypto';
import { pool } from '../database/pool.js';
import { today } from '../validators/customer.validator.js';

export async function lockBill(id, connection) {
  const [rows] = await connection.execute(
    "SELECT id, CAST(total_amount AS CHAR) AS total, DATE_FORMAT(generated_on, '%Y-%m-%d') AS generatedOn FROM bills WHERE id = ? FOR UPDATE",
    [id],
  );
  return rows[0];
}
export async function paidForBill(id, connection) {
  const [[row]] = await connection.execute(
    'SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE bill_id = ?',
    [id],
  );
  return String(row.paid);
}
export async function findRequest(key, connection) {
  const [rows] = await connection.execute(
    `SELECT id, bill_id AS billId, collected_by AS actorId,
    CAST(amount AS CHAR) AS amount, payment_method AS method, COALESCE(reference_number, '') AS reference,
    COALESCE(remarks, '') AS remarks FROM payments WHERE request_key = ?`,
    [key],
  );
  return rows[0];
}
export async function insertPayment(details, actorId, connection) {
  const receipt =
    'OR-' + today().replaceAll('-', '') + '-' + randomBytes(10).toString('hex').toUpperCase();
  await connection.execute(
    `INSERT INTO payments (bill_id, collected_by, receipt_number, request_key, amount,
    payment_method, reference_number, remarks, paid_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
    [
      details.billId,
      actorId,
      receipt,
      details.requestKey,
      details.amount,
      details.method,
      details.reference || null,
      details.remarks || null,
    ],
  );
  const [[row]] = await connection.execute('SELECT CAST(LAST_INSERT_ID() AS CHAR) AS id');
  await connection.execute(
    `INSERT INTO activity_logs (actor_id, actor_role, action, entity_type, entity_id, description)
    VALUES (?, 'admin', 'payment.recorded', 'payment', ?, ?)`,
    [actorId, row.id, receipt + ' | bill ' + details.billId + ' | amount ' + details.amount],
  );
  return row.id;
}

export async function getReceipt(id, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT p.id, p.bill_id AS billId, b.customer_id AS customerId,
    p.receipt_number AS receipt, CAST(p.amount AS CHAR) AS amount, p.payment_method AS method,
    COALESCE(p.reference_number, '') AS reference, COALESCE(p.remarks, '') AS remarks,
    DATE_FORMAT(p.paid_at, '%Y-%m-%dT%H:%i:%sZ') AS createdAt,
    DATE_FORMAT(CONVERT_TZ(p.paid_at, '+00:00', '+08:00'), '%Y-%m-%d') AS date,
    u.username AS collectedBy, c.account_number AS account, c.submitter_number AS submitterNumber,
    CONCAT_WS(' ', c.first_name, NULLIF(c.middle_name, ''), c.last_name, NULLIF(c.extension_name, '')) AS name,
    c.purok AS address, c.street, br.name AS barangay, b.bill_number AS billNumber,
    DATE_FORMAT(b.billing_month, '%Y-%m') AS cycle, DATE_FORMAT(b.due_date, '%Y-%m-%d') AS due,
    CAST(b.previous_reading AS CHAR) AS previous, CAST(b.current_reading AS CHAR) AS current,
    CAST(b.consumption AS CHAR) AS consumption, CAST(b.rate_per_cubic_meter AS CHAR) AS ratePerCubic,
    CAST(b.water_charge AS CHAR) AS water, CAST(b.connection_charge AS CHAR) AS connection,
    CAST(b.late_fee AS CHAR) AS late, CAST(b.other_charge AS CHAR) AS other, CAST(b.total_amount AS CHAR) AS total,
    b.total_amount - COALESCE((SELECT SUM(pr.amount) FROM payments pr WHERE pr.bill_id = p.bill_id AND pr.id < p.id), 0) AS balanceBefore
    FROM payments p JOIN bills b ON b.id = p.bill_id JOIN customers c ON c.id = b.customer_id
    JOIN barangays br ON br.id = b.barangay_id JOIN users u ON u.id = p.collected_by WHERE p.id = ?`,
    [id],
  );
  if (!rows[0]) return null;
  const [[office]] = await connection.query(
    'SELECT office_name AS name, office_address AS address FROM office_settings WHERE id = 1',
  );
  return {
    row: rows[0],
    office: office || { name: 'PIO DURAN WATER SUPPLY SYSTEM', address: 'Pio Duran, Albay' },
  };
}

export async function listPayments(filters, connection = pool) {
  const source = `FROM payments p JOIN bills b ON b.id = p.bill_id JOIN customers c ON c.id = b.customer_id`;
  const conditions = [],
    values = [];
  if (filters.customerId) {
    conditions.push('b.customer_id = ?');
    values.push(filters.customerId);
  }
  if (filters.search) {
    conditions.push(
      "(CONCAT_WS(' ', c.first_name, c.middle_name, c.last_name, c.extension_name) LIKE ? OR c.account_number LIKE ? OR p.receipt_number LIKE ?)",
    );
    values.push(...Array(3).fill('%' + filters.search + '%'));
  }
  if (filters.method) {
    conditions.push('p.payment_method = ?');
    values.push(filters.method);
  }
  if (filters.from) {
    conditions.push('p.paid_at >= ?');
    values.push(filters.from + ' 00:00:00');
  }
  if (filters.to) {
    conditions.push('p.paid_at < ?');
    values.push(filters.to + ' 00:00:00');
  }
  // Date filters are interpreted in the Philippine timezone, not the database host timezone.
  let where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  where = where
    .replace('p.paid_at >= ?', "p.paid_at >= CONVERT_TZ(?, '+08:00', '+00:00')")
    .replace(
      'p.paid_at < ?',
      "p.paid_at < DATE_ADD(CONVERT_TZ(?, '+08:00', '+00:00'), INTERVAL 1 DAY)",
    );
  const [[summary]] = await connection.execute(
    `SELECT COUNT(*) AS total, COALESCE(SUM(p.amount), 0) AS collected,
    COALESCE(SUM(CASE WHEN DATE(CONVERT_TZ(p.paid_at, '+00:00', '+08:00')) = ? THEN p.amount ELSE 0 END), 0) AS today ${source}${where}`,
    [today(), ...values],
  );
  const total = Number(summary.total),
    page = Math.min(filters.page, Math.max(1, Math.ceil(total / filters.limit)));
  const [rows] = await connection.query(
    `SELECT p.id, p.receipt_number AS receipt, CAST(p.amount AS CHAR) AS amount,
    p.payment_method AS method, b.customer_id AS customerId, c.account_number AS account,
    CONCAT_WS(' ', c.first_name, NULLIF(c.middle_name, ''), c.last_name, NULLIF(c.extension_name, '')) AS name,
    DATE_FORMAT(b.billing_month, '%Y-%m') AS cycle,
    DATE_FORMAT(CONVERT_TZ(p.paid_at, '+00:00', '+08:00'), '%Y-%m-%d') AS date
    ${source}${where} ORDER BY p.id DESC LIMIT ? OFFSET ?`,
    [...values, filters.limit, (page - 1) * filters.limit],
  );
  return {
    payments: rows.map((row) => ({
      ...row,
      id: String(row.id),
      customerId: String(row.customerId),
    })),
    pagination: { page, limit: filters.limit, total },
    summary: { collected: String(summary.collected), today: String(summary.today) },
  };
}
