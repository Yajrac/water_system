import { pool } from '../database/pool.js';

export async function listBillingSetups(month, connection = pool) {
  const [rows] = await connection.execute(
    `
    SELECT s.id, s.barangay_id AS barangayId, b.name AS barangay,
      DATE_FORMAT(s.billing_month, '%Y-%m') AS month,
      DATE_FORMAT(s.due_date, '%Y-%m-%d') AS due,
      CAST(s.rate_per_cubic_meter AS CHAR) AS rate
    FROM billing_setups s JOIN barangays b ON b.id = s.barangay_id
    WHERE s.billing_month = ? ORDER BY b.name`,
    [month + '-01'],
  );
  return rows.map((row) => ({ ...row, id: String(row.id), barangayId: String(row.barangayId) }));
}

export async function lockServiceArea(id, connection) {
  const [rows] = await connection.execute(
    'SELECT id, is_active FROM barangays WHERE id = ? FOR UPDATE',
    [id],
  );
  return rows[0];
}

export async function findSetup(details, connection) {
  const [rows] = await connection.execute(
    `SELECT id, DATE_FORMAT(due_date, '%Y-%m-%d') AS due,
    CAST(rate_per_cubic_meter AS CHAR) AS rate FROM billing_setups
    WHERE barangay_id = ? AND billing_month = ? FOR UPDATE`,
    [details.barangayId, details.month + '-01'],
  );
  return rows[0];
}

export async function setupInUse(id, connection) {
  const [rows] = await connection.execute(
    'SELECT id FROM meter_entries WHERE billing_setup_id = ? LIMIT 1',
    [id],
  );
  return rows.length > 0;
}

export async function writeSetup(details, actorId, existing, connection) {
  if (existing) {
    await connection.execute(
      'UPDATE billing_setups SET due_date = ?, rate_per_cubic_meter = ? WHERE id = ?',
      [details.due, details.rate, existing.id],
    );
    return String(existing.id);
  }
  await connection.execute(
    `INSERT INTO billing_setups
    (barangay_id, created_by, billing_month, due_date, rate_per_cubic_meter) VALUES (?, ?, ?, ?, ?)`,
    [details.barangayId, actorId, details.month + '-01', details.due, details.rate],
  );
  // LAST_INSERT_ID is cast by SQL so BIGINT identifiers never pass through JS numbers.
  const [rows] = await connection.execute('SELECT CAST(LAST_INSERT_ID() AS CHAR) AS id');
  return rows[0].id;
}

export async function logSetup(id, details, actorId, updated, connection) {
  await connection.execute(
    `INSERT INTO activity_logs
    (actor_id, actor_role, action, entity_type, entity_id, description)
    VALUES (?, 'admin', ?, 'billing_setup', ?, ?)`,
    [
      actorId,
      updated ? 'billing_setup.updated' : 'billing_setup.created',
      id,
      details.month +
        ' | barangay ' +
        details.barangayId +
        ' | due ' +
        details.due +
        ' | rate ' +
        details.rate,
    ],
  );
}
