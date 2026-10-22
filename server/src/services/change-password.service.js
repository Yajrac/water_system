import { pool } from '../database/pool.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { AppError } from '../utils/app-error.js';

export async function changeOwnPassword(userId, body) {
  const { currentPassword, newPassword } = body || {};
  if (
    typeof currentPassword !== 'string' ||
    !currentPassword ||
    currentPassword.length > 1024 ||
    typeof newPassword !== 'string' ||
    newPassword.length < 8 ||
    newPassword.length > 128
  ) {
    throw new AppError(
      'Provide your current password and a new password of 8–128 characters.',
      400,
    );
  }
  if (currentPassword === newPassword) throw new AppError('Choose a different password.', 400);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[user]] = await connection.execute(
      'SELECT password_hash, role, is_active FROM users WHERE id = ? FOR UPDATE',
      [userId],
    );
    if (!user || Number(user.is_active) !== 1 || !['admin', 'consumer'].includes(user.role))
      throw new AppError('Account is unavailable.', 403);
    if (!(await verifyPassword(user.password_hash, currentPassword)))
      throw new AppError('Current password is incorrect.', 400);
    await connection.execute(
      'UPDATE users SET password_hash = ?, must_change_password = 0, auth_version = auth_version + 1 WHERE id = ?',
      [await hashPassword(newPassword), userId],
    );
    await connection.execute(
      "INSERT INTO activity_logs (actor_id, actor_role, action, entity_type, entity_id, description) VALUES (?, ?, ?, 'users', ?, ?)",
      [userId, user.role, user.role + '.password_changed', userId, 'Account owner changed password.'],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
