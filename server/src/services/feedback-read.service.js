import { pool } from '../database/pool.js';
import { AppError } from '../utils/app-error.js';

export async function unreadFeedback(userId) {
  const [[row]] = await pool.execute(
    `SELECT COUNT(*) AS unread FROM feedback_threads t
     WHERE NOT EXISTS (SELECT 1 FROM notification_reads r
       WHERE r.user_id=? AND r.notification_key=CONCAT('admin-feedback:',t.id))`,
    [userId],
  );
  return { unread: Number(row.unread) };
}

export async function readFeedback(id, userId) {
  if (!/^[1-9]\d{0,19}$/.test(id)) throw new AppError('Invalid feedback.', 400);
  const [result] = await pool.execute(
    `INSERT INTO notification_reads (user_id,notification_key)
     SELECT ?,CONCAT('admin-feedback:',id) FROM feedback_threads WHERE id=?
     ON DUPLICATE KEY UPDATE read_at=read_at`,
    [userId, id],
  );
  if (!result.affectedRows) {
    const [[thread]] = await pool.execute('SELECT id FROM feedback_threads WHERE id=?', [id]);
    if (!thread) throw new AppError('Feedback not found.', 404);
  }
  return { id, read: true };
}
