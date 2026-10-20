import { pool } from '../database/pool.js';

export async function findUserByUsername(username) {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        username,
        password_hash,
        role,
        is_active
      FROM users
      WHERE username = ?
      LIMIT 1
    `,
    [username],
  );

  return rows[0] || null;
}

export async function updateLastLogin(userId) {
  await pool.execute(
    `
      UPDATE users
      SET last_login_at = UTC_TIMESTAMP()
      WHERE id = ?
    `,
    [userId],
  );
}