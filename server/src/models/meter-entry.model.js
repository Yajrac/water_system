import { pool } from '../database/pool.js';
import { loadLateFeeData, customerLateFee } from '../services/late-fee.service.js';

export async function findSetup(id, connection = pool, lock = false) {
  const [rows] = await connection.execute(
    `SELECT s.id, s.barangay_id AS barangayId,
    b.name AS barangay, b.is_active AS active, DATE_FORMAT(s.billing_month, '%Y-%m') AS month,
    DATE_FORMAT(s.due_date, '%Y-%m-%d') AS due, CAST(s.rate_per_cubic_meter AS CHAR) AS rate
    FROM billing_setups s JOIN barangays b ON b.id = s.barangay_id WHERE s.id = ? ${lock ? 'FOR UPDATE' : ''}`,
    [id],
  );
  return rows[0];
}

const customerColumns = `c.id, c.barangay_id AS barangayId, c.account_number AS account,
  CONCAT_WS(' ', c.first_name, NULLIF(c.middle_name, ''), c.last_name, NULLIF(c.extension_name, '')) AS name,
  c.connection_status AS connectionStatus, a.status AS serviceStatus, m.id AS meterId,
  CAST(m.current_reading AS CHAR) AS previous, m.meter_number AS meterNumber`;
const customerJoins = `FROM customers c
  JOIN customer_applications a ON a.id = (SELECT MAX(ca.id) FROM customer_applications ca WHERE ca.customer_id = c.id)
  JOIN water_meters m ON m.id = (SELECT MAX(wm.id) FROM water_meters wm WHERE wm.customer_id = c.id AND wm.is_active = 1)`;

export async function listConsumers(setup, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT ${customerColumns} ${customerJoins}
    WHERE c.barangay_id = ? AND c.connection_status = 'Active' AND a.status = 'Installed'
      AND NOT EXISTS(SELECT 1 FROM bills b WHERE b.customer_id = c.id AND b.billing_month >= ?)
    ORDER BY c.last_name, c.first_name, c.id`,
    [setup.barangayId, setup.month + '-01'],
  );
  const feeData = await loadLateFeeData(rows.map((row) => String(row.id)), connection);
  return rows.map((row) => ({ ...row, suggestedLate: customerLateFee(feeData, row.id).amount }));
}

export async function lockConsumer(id, connection) {
  await connection.execute('SELECT id FROM customers WHERE id = ? FOR UPDATE', [id]);
  const [rows] = await connection.execute(
    `SELECT ${customerColumns} ${customerJoins} WHERE c.id = ?`,
    [id],
  );
  if (rows[0]) {
    const [meters] = await connection.execute(
      'SELECT CAST(current_reading AS CHAR) AS previous FROM water_meters WHERE id = ? FOR UPDATE',
      [rows[0].meterId],
    );
    rows[0].previous = meters[0].previous;
  }
  return rows[0];
}

export async function hasBill(customerId, month, connection) {
  const [rows] = await connection.execute(
    'SELECT id FROM bills WHERE customer_id = ? AND billing_month >= ? LIMIT 1',
    [customerId, month + '-01'],
  );
  return rows.length > 0;
}

const entryColumns = `id, customer_id AS customerId, meter_id AS meterId,
  CAST(previous_reading AS CHAR) AS previous, CAST(consumption AS CHAR) AS consumption,
  CAST(current_reading AS CHAR) AS current, CAST(connection_charge AS CHAR) AS connectionCharge,
  CAST(late_fee AS CHAR) AS late, CAST(other_charge AS CHAR) AS other, status,
  late_fee_basis AS lateFeeBasis,
  recorded_by AS recordedBy, CAST(updated_at AS CHAR) AS updatedAt`;

export async function listEntries(setupId, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT ${entryColumns} FROM meter_entries WHERE billing_setup_id = ?`,
    [setupId],
  );
  return rows;
}

export async function findEntry(details, connection) {
  const [rows] = await connection.execute(
    `SELECT ${entryColumns} FROM meter_entries WHERE billing_setup_id = ? AND customer_id = ? FOR UPDATE`,
    [details.setupId, details.customerId],
  );
  return rows[0];
}

export async function saveEntry(details, consumer, actorId, existing, connection) {
  const data = await loadLateFeeData([String(consumer.id)], connection);
  const { basis, amount: suggestedLate } = customerLateFee(data, consumer.id);
  const values = [
    consumer.previous,
    details.consumption,
    details.connectionCharge,
    details.late,
    details.other,
    JSON.stringify(basis),
    actorId,
  ];
  if (existing) {
    await connection.execute(
      `UPDATE meter_entries SET previous_reading = ?, consumption = ?, connection_charge = ?, late_fee = ?, other_charge = ?, late_fee_basis = ?, recorded_by = ? WHERE id = ?`,
      [...values, existing.id],
    );
  } else {
    await connection.execute(
      `INSERT INTO meter_entries
      (previous_reading, consumption, connection_charge, late_fee, other_charge, late_fee_basis, recorded_by, billing_setup_id, customer_id, meter_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...values, details.setupId, details.customerId, consumer.meterId],
    );
  }
  const saved = await findEntry(details, connection);
  await connection.execute(
    `INSERT INTO activity_logs
    (actor_id, actor_role, action, entity_type, entity_id, description)
    VALUES (?, 'admin', ?, 'meter_entry', ?, ?)`,
    [
      actorId,
      existing ? 'meter_entry.updated' : 'meter_entry.created',
      saved.id,
      consumer.account + ' | consumption ' + details.consumption + ' m3 | late fee ' + details.late + ' | suggested ' + suggestedLate,
    ],
  );
  return saved;
}
