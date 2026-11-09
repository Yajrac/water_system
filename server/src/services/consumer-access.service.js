import { pool } from '../database/pool.js';
import { AppError } from '../utils/app-error.js';

export async function requireInstalledConsumer(userId, database = pool) {
  const [[row]] = await database.execute(`SELECT a.status FROM customers c
    LEFT JOIN customer_applications a ON a.id=(SELECT MAX(id) FROM customer_applications WHERE customer_id=c.id)
    WHERE c.user_id=?`, [userId]);
  if (!row || row.status !== 'Installed')
    throw new AppError('Available after installation. Check your application progress on Home.', 403);
}
