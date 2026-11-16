import { pool } from '../database/pool.js';
import { hashPassword } from '../utils/password.js';
import { AppError } from '../utils/app-error.js';

export const FORGOT_PASSWORD_ACTION = 'consumer.password_reset';
export const DAILY_RESET_LIMIT = 3;

export function validateForgotPassword(body) {
  const { accountNumber, newPassword } = body || {};
  if (typeof accountNumber !== 'string' || !accountNumber.trim() || accountNumber.trim().length > 40)
    throw new AppError('Enter your account number.', 400, { field: 'accountNumber' });
  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128)
    throw new AppError('Enter a new password of 8–128 characters.', 400, { field: 'newPassword' });
  return { accountNumber: accountNumber.trim(), newPassword };
}

// Consumer self-service reset by account number (office-approved policy).
// Limited per account per day, signs out every existing session, and leaves an
// audit entry that also appears as a security notice in the consumer app.
export async function resetForgottenPassword(body, db = pool) {
  const { accountNumber, newPassword } = validateForgotPassword(body);
  const passwordHash = await hashPassword(newPassword);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [users] = await connection.execute(
      `SELECT u.id, u.is_active FROM customers c JOIN users u ON u.id = c.user_id
       WHERE c.account_number = ? AND u.role = 'consumer' LIMIT 2 FOR UPDATE`,
      [accountNumber],
    );
    if (users.length !== 1 || Number(users[0].is_active) !== 1)
      throw new AppError(
        'No active app account uses this account number. Check the number on your bill or contact the PWSS office.',
        400, // not 404: the consumer app shows 404 as "service unavailable"
        { field: 'accountNumber' },
      );
    const userId = users[0].id;
    const [[recent]] = await connection.execute(
      `SELECT COUNT(*) AS total FROM activity_logs
       WHERE actor_id = ? AND action = ? AND created_at > UTC_TIMESTAMP() - INTERVAL 1 DAY`,
      [userId, FORGOT_PASSWORD_ACTION],
    );
    if (Number(recent.total) >= DAILY_RESET_LIMIT)
      throw new AppError(
        'This account has reached today\'s password reset limit. Try again tomorrow or contact the PWSS office.',
        429,
      );
    await connection.execute(
      'UPDATE users SET password_hash = ?, must_change_password = 0, auth_version = auth_version + 1 WHERE id = ?',
      [passwordHash, userId],
    );
    await connection.execute(
      `INSERT INTO activity_logs (actor_id, actor_role, action, entity_type, entity_id, description)
       VALUES (?, 'consumer', ?, 'users', ?, ?)`,
      [userId, FORGOT_PASSWORD_ACTION, userId, 'Password reset with account number ' + accountNumber + ' (Forgot password).'],
    );
    await connection.commit();
    return { reset: true, signInRequired: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
