import { pool } from '../database/pool.js';

export async function findAllBarangays() {
  const [rows] = await pool.execute(`
    SELECT
      id,
      psgc_code,
      name,
      municipality,
      province,
      is_active
    FROM barangays
    ORDER BY name ASC
  `);

  return rows;
}

export async function findBarangayById(id) {
  const [rows] = await pool.execute(
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