import { pool } from '../database/pool.js';
import { AppError } from '../utils/app-error.js';
import { resolveImportBarangay } from '../validators/barangay.validator.js';
import { recordBarangayActivity } from '../models/activity-log.model.js';

export function importBarangays(entries) {
  return [
    ...new Map(
      entries
        .filter((entry) => entry.barangayName)
        .map((entry) => {
          const area = resolveImportBarangay(entry.barangayName);
          return [area.psgcCode, area];
        }),
    ).values(),
  ].sort((a, b) => a.psgcCode.localeCompare(b.psgcCode));
}

export async function findImportBarangay(area, connection = pool, lock = false) {
  const [rows] = await connection.execute(
    `SELECT id, psgc_code, name, is_active FROM barangays
    WHERE psgc_code = ? OR (name = ? AND municipality = ? AND province = ?) ${lock ? 'FOR UPDATE' : ''}`,
    [area.psgcCode, area.name, area.municipality, area.province],
  );
  if (rows.length > 1 || (rows[0] && rows[0].psgc_code !== area.psgcCode))
    throw new AppError('Conflicting barangay registration for ' + area.name + '.', 409);
  if (rows[0] && Number(rows[0].is_active) !== 1)
    throw new AppError(area.name + ' is inactive. Activate it before importing customers.', 409);
  return rows[0] || null;
}

export async function registerImportBarangays(entries, actorId, connection) {
  const ids = new Map();
  let registered = 0;
  for (const area of importBarangays(entries)) {
    let stored = await findImportBarangay(area, connection, true);
    if (!stored) {
      await connection.execute(
        'INSERT INTO barangays (psgc_code, name, municipality, province) VALUES (?, ?, ?, ?)',
        [area.psgcCode, area.name, area.municipality, area.province],
      );
      const [[row]] = await connection.execute('SELECT CAST(LAST_INSERT_ID() AS CHAR) AS id');
      stored = row;
      await recordBarangayActivity(connection, actorId, 'barangay.created', {
        id: row.id,
        name: area.name,
      });
      registered++;
    }
    ids.set(area.name, String(stored.id));
  }
  return { ids, registered };
}
