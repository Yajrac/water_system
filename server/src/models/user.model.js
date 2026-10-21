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

// Generate passwordHash using the shared Argon2 helper before calling this function.
export async function createAdminUser(username, passwordHash) {
  const [result] = await pool.execute(
    `
      INSERT INTO users (
        username,
        password_hash,
        role,
        is_active
      )
      VALUES (?, ?, 'admin', 1)
    `,
    [username, passwordHash],
  );

  return result.insertId;
}

export async function findUserById(id) {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        username,
        role,
        is_active
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  );

  return rows[0] || null;
}
