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
      'SELECT password_hash, role, is_active, must_change_password FROM users WHERE id = ? FOR UPDATE',
      [userId],
    );
    if (!user || Number(user.is_active) !== 1 || !['admin', 'consumer'].includes(user.role))
      throw new AppError('Account is unavailable.', 403);
    if (!(await verifyPassword(user.password_hash, currentPassword)))
      throw new AppError('Current password is incorrect.', 400);
    if (user.role === 'consumer' && !Number(user.must_change_password)) {
      const [[cooldown]] = await connection.execute(
        `SELECT DATE_FORMAT(CONVERT_TZ(DATE_ADD(MAX(created_at), INTERVAL 14 DAY), '+00:00', '+08:00'), '%Y-%m-%d %H:%i') AS nextChange
         FROM activity_logs WHERE actor_id=? AND action='consumer.password_changed'
         HAVING DATE_ADD(MAX(created_at), INTERVAL 14 DAY) > UTC_TIMESTAMP()`,
        [userId],
      );
      if (cooldown?.nextChange)
        throw new AppError(
          'You can change your password again on ' + cooldown.nextChange + ' (Philippine time). Contact the PWSS office if you need a reset sooner.',
          429,
        );
    }
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
