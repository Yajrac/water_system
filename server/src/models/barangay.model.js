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

// What still points at a barangay. Billing setups count only once they hold meter
// readings; empty monthly setups are removed with the barangay.
export async function barangayUsage(id, connection) {
  const [[row]] = await connection.execute(
    `SELECT
       (SELECT COUNT(*) FROM customers WHERE barangay_id = ?) AS customers,
       (SELECT COUNT(*) FROM billing_setups s WHERE s.barangay_id = ?
          AND EXISTS(SELECT 1 FROM meter_entries e WHERE e.billing_setup_id = s.id)) AS usedSetups,
       (SELECT COUNT(*) FROM bills WHERE barangay_id = ?) AS bills,
       (SELECT COUNT(*) FROM announcement_barangays WHERE barangay_id = ?) AS announcements`,
    [id, id, id, id],
  );
  return {
    customers: Number(row.customers),
    usedSetups: Number(row.usedSetups),
    bills: Number(row.bills),
    announcements: Number(row.announcements),
  };
}

export async function deleteUnusedSetups(id, connection) {
  await connection.execute(
    `DELETE FROM billing_setups WHERE barangay_id = ?
     AND NOT EXISTS(SELECT 1 FROM meter_entries e WHERE e.billing_setup_id = billing_setups.id)`,
    [id],
  );
}

export async function deleteBarangay(id, connection) {
  await connection.execute('DELETE FROM barangays WHERE id = ?', [id]);
}
