import { pool } from '../database/pool.js';

export async function findUserByLogin(username) {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        username,
        password_hash,
        role,
        is_active,
        must_change_password,
        auth_version
      FROM users
      WHERE username = ? OR (role = 'consumer' AND id IN (
        SELECT user_id FROM customers WHERE account_number = ? AND user_id IS NOT NULL
      ))
      LIMIT 2
    `,
    [username, username],
  );

  // Ambiguous identifiers never authenticate an unintended account.
  return rows.length === 1 ? rows[0] : null;
}

export async function findUserByUsername(username) {
  const [rows] = await pool.execute(
    'SELECT id, username, role FROM users WHERE username = ? LIMIT 1',
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
        is_active,
        must_change_password
      )
      VALUES (?, ?, 'admin', 1, 1)
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
        is_active,
        must_change_password,
        auth_version
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  );

  return rows[0] || null;
}
