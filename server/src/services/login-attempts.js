import { AppError } from '../utils/app-error.js';

export function loginAttemptState(state, failed, now) {
  const until = state.locked_until ? new Date(state.locked_until).getTime() : 0;
  if (until > now) return { failures: state.failures, lockedUntil: new Date(until), retryAfterSeconds: Math.ceil((until - now) / 1000) };
  const failures = failed ? (until ? 0 : Number(state.failures)) + 1 : 0;
  return { failures, lockedUntil: failures >= 5 ? new Date(now + 300000) : null, retryAfterSeconds: failures >= 5 ? 300 : 0 };
}

// Serialize attempts for the same account across workers and app restarts.
export async function checkLoginAttempt(pool, key, verify) {
  const connection = await pool.getConnection();
  let outcome;
  try {
    await connection.beginTransaction();
    await connection.execute('INSERT INTO login_attempts (attempt_key) VALUES (?) ON DUPLICATE KEY UPDATE attempt_key = attempt_key', [key]);
    const [[state]] = await connection.execute('SELECT failures, locked_until, UTC_TIMESTAMP() AS now FROM login_attempts WHERE attempt_key = ? FOR UPDATE', [key]);
    const now = new Date(state.now).getTime();
    let next = loginAttemptState(state, false, now);
    if (!next.retryAfterSeconds) {
      outcome = await verify();
      next = loginAttemptState(state, Boolean(outcome), now);
      await connection.execute('UPDATE login_attempts SET failures = ?, locked_until = ? WHERE attempt_key = ?', [next.failures, next.lockedUntil, key]);
    }
    await connection.commit();
    if (next.retryAfterSeconds) outcome = new AppError('Too many attempts. Please try again later.', 429, { code: 'LOGIN_LOCKED', retryAfterSeconds: next.retryAfterSeconds });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
  if (outcome) throw outcome;
}
