import { pool } from '../database/pool.js';
import { activityFilters } from '../validators/activity.validator.js';

export async function readActivity(query) {
  const filters = activityFilters(query);
  const connection = await pool.getConnection();
  const conditions = ['l.actor_role = ?'];
  const values = [filters.role];
  if (filters.start) {
    conditions.push('l.created_at >= ? AND l.created_at < ?');
    values.push(filters.start, filters.end);
  }
  if (filters.search) {
    conditions.push(
      '(l.action LIKE ? OR l.description LIKE ? OR u.username LIKE ? OR l.entity_type LIKE ? OR CAST(l.entity_id AS CHAR) LIKE ?)',
    );
    values.push(...Array(5).fill('%' + filters.search + '%'));
  }
  const source =
    ' FROM activity_logs l LEFT JOIN users u ON u.id = l.actor_id WHERE ' +
    conditions.join(' AND ');
  try {
    await connection.beginTransaction();
    const [[count]] = await connection.execute('SELECT COUNT(*) AS total' + source, values);
    const total = Number(count.total);
    const page = Math.min(filters.page, Math.max(1, Math.ceil(total / 10)));
    const [rows] = await connection.query(
      `SELECT CAST(l.id AS CHAR) AS id, l.action,
      l.entity_type AS entityType, CAST(l.entity_id AS CHAR) AS entityId,
      l.description AS details, COALESCE(u.username, 'Unavailable account') AS actor,
      DATE_FORMAT(l.created_at, '%Y-%m-%dT%H:%i:%sZ') AS timestamp` +
        source +
        ' ORDER BY l.created_at DESC, l.id DESC LIMIT 10 OFFSET ?',
      [...values, (page - 1) * 10],
    );
    await connection.commit();
    return { logs: rows, pagination: { page, limit: 10, total } };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
