import { randomBytes } from 'node:crypto';
import { pool } from '../database/pool.js';
import { today } from '../validators/customer.validator.js';

export async function insertBill(
  setup,
  customer,
  entry,
  amounts,
  actorId,
  generatedOn,
  connection,
) {
  const number =
    'BILL-' + generatedOn.replaceAll('-', '') + '-' + randomBytes(10).toString('hex').toUpperCase();
  await connection.execute(
    `INSERT INTO bills
    (meter_entry_id, customer_id, barangay_id, generated_by, bill_number, billing_month,
     generated_on, due_date, previous_reading, current_reading, consumption, rate_per_cubic_meter,
     water_charge, connection_charge, late_fee, other_charge, total_amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      customer.id,
      setup.barangayId,
      actorId,
      number,
      setup.month + '-01',
      generatedOn,
      setup.due,
      entry.previous,
      entry.current,
      entry.consumption,
      setup.rate,
      amounts.water,
      entry.connectionCharge,
      entry.late,
      entry.other,
      amounts.total,
    ],
  );
  await connection.execute("UPDATE meter_entries SET status = 'Billed' WHERE id = ?", [entry.id]);
  await connection.execute('UPDATE water_meters SET current_reading = ? WHERE id = ?', [
    entry.current,
    customer.meterId,
  ]);
}

export async function logGeneration(setup, actorId, count, connection) {
  await connection.execute(
    `INSERT INTO activity_logs (actor_id, actor_role, action, entity_type, entity_id, description)
    VALUES (?, 'admin', 'bills.generated', 'billing_setup', ?, ?)`,
    [actorId, setup.id, setup.month + ' | ' + setup.barangay + ' | ' + count + ' bills generated'],
  );
}

export async function listBills(filters, connection = pool) {
  const projection = `SELECT b.id, b.customer_id AS customerId, b.bill_number AS billNumber,
    c.account_number AS account, c.submitter_number AS submitterNumber, b.barangay_id AS barangayId,
    br.name AS barangay, c.purok AS address, c.street,
    CONCAT_WS(' ', c.first_name, NULLIF(c.middle_name, ''), c.last_name, NULLIF(c.extension_name, '')) AS name,
    c.customer_type AS customerType, DATE_FORMAT(b.billing_month, '%Y-%m') AS cycle,
    DATE_FORMAT(b.generated_on, '%Y-%m-%d') AS generatedOn, DATE_FORMAT(b.due_date, '%Y-%m-%d') AS due,
    CAST(b.previous_reading AS CHAR) AS previous, CAST(b.current_reading AS CHAR) AS current,
    CAST(b.consumption AS CHAR) AS consumption, CAST(b.rate_per_cubic_meter AS CHAR) AS ratePerCubic,
    CAST(b.water_charge AS CHAR) AS water, CAST(b.connection_charge AS CHAR) AS connection,
    CAST(b.late_fee AS CHAR) AS late, CAST(b.other_charge AS CHAR) AS other, CAST(b.total_amount AS CHAR) AS total,
    GREATEST(b.total_amount - COALESCE(p.paid, 0), 0) AS balance,
    CASE WHEN b.total_amount <= COALESCE(p.paid, 0) THEN 'Paid'
      WHEN b.due_date < ? THEN 'Overdue' ELSE 'Unpaid' END AS status
    FROM bills b JOIN customers c ON c.id = b.customer_id JOIN barangays br ON br.id = b.barangay_id
    LEFT JOIN (SELECT bill_id, SUM(amount) AS paid FROM payments GROUP BY bill_id) p ON p.bill_id = b.id`;
  const conditions = [],
    values = [today()];
  if (filters.barangayId) {
    conditions.push('barangayId = ?');
    values.push(filters.barangayId);
  }
  if (filters.customerId) {
    conditions.push('customerId = ?');
    values.push(filters.customerId);
  }
  if (filters.billId) {
    conditions.push('id = ?');
    values.push(filters.billId);
  }
  if (filters.search) {
    conditions.push(
      '(name LIKE ? OR account LIKE ? OR billNumber LIKE ? OR submitterNumber LIKE ?)',
    );
    values.push(...Array(4).fill('%' + filters.search + '%'));
  }
  if (filters.month) {
    conditions.push('cycle = ?');
    values.push(filters.month);
  }
  if (filters.due) {
    conditions.push('due = ? AND balance > 0');
    values.push(filters.due);
  }
  if (filters.status === 'outstanding') conditions.push('balance > 0');
  else if (filters.status) {
    conditions.push('status = ?');
    values.push(filters.status);
  }
  const source =
    '(' +
    projection +
    ') bill_list' +
    (conditions.length ? ' WHERE ' + conditions.join(' AND ') : '');
  const [[count]] = await connection.execute('SELECT COUNT(*) AS total FROM ' + source, values);
  const total = Number(count.total);
  const page = Math.min(filters.page, Math.max(1, Math.ceil(total / filters.limit)));
  const [rows] = await connection.query(
    'SELECT * FROM ' + source + ' ORDER BY generatedOn DESC, id DESC LIMIT ? OFFSET ?',
    [...values, filters.limit, (page - 1) * filters.limit],
  );
  return {
    bills: rows.map((row) => ({
      ...row,
      id: String(row.id),
      customerId: String(row.customerId),
      billingMode: 'flat',
      monthly: 0,
    })),
    pagination: { page, limit: filters.limit, total },
  };
}
