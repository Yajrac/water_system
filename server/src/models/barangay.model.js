import { pool } from '../database/pool.js';

export async function findAllBarangays() {
  const [rows] = await pool.execute(`
    SELECT
      b.id,
      b.psgc_code,
      b.name,
      b.municipality,
      b.province,
      b.is_active,
      (SELECT COUNT(*) FROM customers c WHERE c.barangay_id = b.id) AS customer_count
    FROM barangays b
    ORDER BY b.name ASC
  `);

  return rows;
}

export async function findBarangayById(id, connection = pool) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        psgc_code,
        name,
        municipality,
        province,
        is_active
      FROM barangays
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  );

  return rows[0] || null;
}

export async function createBarangay(
  { psgcCode, name, municipality, province },
  connection = pool,
) {
  const [result] = await connection.execute(
    `
      INSERT INTO barangays (
        psgc_code,
        name,
        municipality,
        province
      )
      VALUES (?, ?, ?, ?)
    `,
    [psgcCode, name, municipality, province],
  );

  return findBarangayById(result.insertId, connection);
}

export async function lockBarangayById(id, connection) {
  const [rows] = await connection.execute(
    'SELECT id, psgc_code, name, municipality, province, is_active FROM barangays WHERE id = ? FOR UPDATE',
    [id],
  );
  return rows[0] || null;
}

export async function findConflictingBarangay(details, excludedId, connection) {
  const [rows] = await connection.execute(
    `SELECT id FROM barangays
     WHERE id <> ? AND (
       psgc_code = ? OR (province = ? AND municipality = ? AND name = ?)
     ) LIMIT 1`,
    [excludedId || '0', details.psgcCode, details.province, details.municipality, details.name],
  );
  return rows[0] || null;
}

export async function isBarangayInUse(id, connection) {
  const [[row]] = await connection.execute(
    `SELECT (
       EXISTS(SELECT 1 FROM customers WHERE barangay_id = ?) OR
       EXISTS(SELECT 1 FROM billing_setups WHERE barangay_id = ?) OR
       EXISTS(SELECT 1 FROM bills WHERE barangay_id = ?) OR
       EXISTS(SELECT 1 FROM announcement_barangays WHERE barangay_id = ?)
     ) AS in_use`,
    [id, id, id, id],
  );
  return Number(row.in_use) === 1;
}

export async function deleteBarangay(id, connection) {
  await connection.execute('DELETE FROM barangays WHERE id = ?', [id]);
}
