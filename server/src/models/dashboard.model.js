import { pool } from '../database/pool.js';

export async function readDashboard({ day, month, start, end }, database = pool) {
  const connection = await database.getConnection();
  try {
    // InnoDB consistent reads share one snapshot, preventing mixed payment/bill totals.
    await connection.beginTransaction();
    const [[customers]] = await connection.query(`SELECT COUNT(*) AS totalCustomers,
      COALESCE(SUM(a.status IN ('Approved', 'Installed')), 0) AS registeredCustomers
      FROM customers c LEFT JOIN customer_applications a ON a.id =
      (SELECT MAX(ca.id) FROM customer_applications ca WHERE ca.customer_id = c.id)`);
    const [[areas]] = await connection.query(`SELECT COUNT(*) AS barangays,
      COALESCE(SUM(is_active = 1), 0) AS activeBarangays FROM barangays`);
    const [[billing]] = await connection.execute(
      `SELECT COUNT(*) AS bills,
      COALESCE(SUM(balance), 0) AS outstanding,
      COALESCE(SUM(balance > 0), 0) AS unpaidBills,
      COALESCE(SUM(balance = 0), 0) AS paid,
      COALESCE(SUM(balance > 0 AND due_date >= ?), 0) AS unpaid,
      COALESCE(SUM(balance > 0 AND due_date < ?), 0) AS overdue
      FROM (SELECT b.due_date, GREATEST(b.total_amount - COALESCE(p.paid, 0), 0) AS balance
        FROM bills b LEFT JOIN (SELECT bill_id, SUM(amount) AS paid FROM payments GROUP BY bill_id) p
        ON p.bill_id = b.id) balances`,
      [day, day],
    );
    const [[payments]] = await connection.execute(
      `SELECT COALESCE(SUM(amount), 0) AS totalCollections,
      COALESCE(SUM(CASE WHEN paid_at >= CONVERT_TZ(?, '+08:00', '+00:00')
        AND paid_at < DATE_ADD(CONVERT_TZ(?, '+08:00', '+00:00'), INTERVAL 1 DAY) THEN amount ELSE 0 END), 0) AS todayCollections,
      COALESCE(SUM(CASE WHEN paid_at >= CONVERT_TZ(?, '+08:00', '+00:00')
        AND paid_at < CONVERT_TZ(?, '+08:00', '+00:00') THEN amount ELSE 0 END), 0) AS monthCollections
      FROM payments`,
      [day + ' 00:00:00', day + ' 00:00:00', month + '-01 00:00:00', end + ' 00:00:00'],
    );
    const [collections] = await connection.execute(
      `SELECT DATE_FORMAT(CONVERT_TZ(paid_at, '+00:00', '+08:00'), '%Y-%m') AS month,
      SUM(amount) AS amount FROM payments WHERE paid_at >= CONVERT_TZ(?, '+08:00', '+00:00')
      AND paid_at < CONVERT_TZ(?, '+08:00', '+00:00') GROUP BY month ORDER BY month`,
      [start + ' 00:00:00', end + ' 00:00:00'],
    );
    const [consumption] = await connection.execute(
      `SELECT br.id AS barangayId, br.name AS barangay,
      COALESCE(v.volume, 0) AS volume FROM barangays br LEFT JOIN (
        SELECT barangay_id, SUM(consumption) AS volume FROM bills WHERE billing_month >= ?
        AND billing_month < ? GROUP BY barangay_id
      ) v ON v.barangay_id = br.id ORDER BY br.name, br.id`,
      [start, end],
    );
    await connection.commit();
    return { customers, areas, billing, payments, collections, consumption };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
