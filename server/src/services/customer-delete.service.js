import { pool } from '../database/pool.js';
import { customerId } from '../validators/customer.validator.js';
import { AppError } from '../utils/app-error.js';

export function deletionIds(body) {
  if (!body || Object.keys(body).some((key) => key !== 'ids') ||
      !Array.isArray(body.ids) || !body.ids.length || body.ids.length > 100) {
    throw new AppError('Select between 1 and 100 customers to delete.', 400);
  }
  const ids = body.ids.map(customerId);
  if (new Set(ids).size !== ids.length) throw new AppError('Duplicate customer IDs.', 400);
  return ids.sort((a, b) => BigInt(a) < BigInt(b) ? -1 : 1);
}

// Explicit child-first deletes preserve FK checks and transaction rollback.
export async function deleteCustomers(body, actorId, database = pool) {
  const ids = deletionIds(body);
  const marks = ids.map(() => '?').join(',');
  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    const [customers] = await connection.execute(
      `SELECT id, user_id, account_number FROM customers WHERE id IN (${marks}) ORDER BY id FOR UPDATE`, ids);
    if (customers.length !== ids.length) throw new AppError('A selected customer no longer exists. Reload and try again.', 409);
    const users = customers.filter((c) => c.user_id).map((c) => String(c.user_id));
    for (const id of users) {
      const [[user]] = await connection.execute('SELECT role FROM users WHERE id = ? FOR UPDATE', [id]);
      if (!user || user.role !== 'consumer' || id === String(actorId))
        throw new AppError('A selected customer has an invalid linked login account.', 409);
    }
    // Lock financial parents before deleting children; concurrent payments must finish first.
    await connection.execute(`SELECT id FROM meter_entries WHERE customer_id IN (${marks}) ORDER BY id FOR UPDATE`, ids);
    await connection.execute(`SELECT id FROM bills WHERE customer_id IN (${marks}) ORDER BY id FOR UPDATE`, ids);
    const statements = [
      `DELETE f FROM late_fee_assessments f JOIN bills b ON b.id=f.source_bill_id WHERE b.customer_id IN (${marks})`,
      `DELETE f FROM late_fee_assessments f JOIN meter_entries m ON m.id=f.meter_entry_id WHERE m.customer_id IN (${marks})`,
      `DELETE p FROM payments p JOIN bills b ON b.id=p.bill_id WHERE b.customer_id IN (${marks})`,
      `DELETE FROM bills WHERE customer_id IN (${marks})`,
      `DELETE FROM meter_entries WHERE customer_id IN (${marks})`,
      `DELETE FROM water_meters WHERE customer_id IN (${marks})`,
      `DELETE d FROM application_documents d JOIN customer_applications a ON a.id=d.application_id WHERE a.customer_id IN (${marks})`,
      `DELETE e FROM application_estimates e JOIN customer_applications a ON a.id=e.application_id WHERE a.customer_id IN (${marks})`,
      `DELETE FROM customer_applications WHERE customer_id IN (${marks})`,
      `DELETE m FROM feedback_messages m JOIN feedback_threads t ON t.id=m.thread_id WHERE t.customer_id IN (${marks})`,
      `DELETE FROM feedback_threads WHERE customer_id IN (${marks})`,
      `DELETE FROM announcement_recipients WHERE customer_id IN (${marks})`,
      `DELETE FROM connection_events WHERE customer_id IN (${marks})`,
      `DELETE FROM customers WHERE id IN (${marks})`,
    ];
    for (const sql of statements) await connection.execute(sql, ids);
    for (const id of users) {
      await connection.execute('DELETE d FROM push_deliveries d JOIN push_devices p ON p.id=d.device_id WHERE p.user_id=?', [id]);
      await connection.execute('DELETE FROM push_devices WHERE user_id=?', [id]);
      await connection.execute('DELETE FROM notification_reads WHERE user_id=?', [id]);
      // Retain historical audit records even when their consumer actor is removed.
      await connection.execute('UPDATE activity_logs SET actor_id=NULL WHERE actor_id=?', [id]);
      await connection.execute("DELETE FROM users WHERE id=? AND role='consumer'", [id]);
    }
    for (const customer of customers) {
      await connection.execute(`INSERT INTO activity_logs
        (actor_id, actor_role, action, entity_type, entity_id, description)
        VALUES (?, 'admin', 'delete', 'customer', ?, ?)`,
      [actorId, customer.id, 'Permanently deleted customer ' + customer.account_number + ' and all related customer records, including bills and payments.']);
    }
    await connection.commit();
    return { count: customers.length };
  } catch (error) {
    await connection.rollback();
    if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT', 'ER_ROW_IS_REFERENCED_2'].includes(error.code))
      throw new AppError('Related records changed or prevent deletion. Reload and try again.', 409);
    throw error;
  } finally {
    connection.release();
  }
}
