import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import jwt from 'jsonwebtoken';

import { authConfig } from '../config/auth.js';
import { AppError } from '../utils/app-error.js';
import { verifyPassword } from '../utils/password.js';
import { checkLoginAttempt } from './login-attempts.js';

// Owner tokens use their own audience, so the admin and consumer APIs reject them
// and admin tokens are rejected here.
const OWNER_AUDIENCE = 'water-system-owner';
const OWNER_TOKEN_LIFETIME = '15m';

// Every table that holds a customer's records, children before parents, so no
// RESTRICT foreign key blocks the delete. The same WHERE clause drives the preview
// count, the JSON backup and the DELETE.
export function customerDeleteSteps(customerId, userId) {
  const bills = 'SELECT id FROM bills WHERE customer_id = ?';
  const entries = 'SELECT id FROM meter_entries WHERE customer_id = ?';
  const applications = 'SELECT id FROM customer_applications WHERE customer_id = ?';
  const threads = 'SELECT id FROM feedback_threads WHERE customer_id = ?';
  const c = [customerId];
  const steps = [
    ['payments', 'bill_id IN (' + bills + ')', c],
    ['bill_late_fee_events', 'bill_id IN (' + bills + ')', c],
    [
      'late_fee_assessments',
      'source_bill_id IN (' + bills + ') OR meter_entry_id IN (' + entries + ')',
      [customerId, customerId],
    ],
    ['bills', 'customer_id = ?', c],
    ['meter_entries', 'customer_id = ?', c],
    ['water_meters', 'customer_id = ?', c],
    ['application_documents', 'application_id IN (' + applications + ')', c],
    ['application_estimates', 'application_id IN (' + applications + ')', c],
    ['customer_applications', 'customer_id = ?', c],
    ['announcement_recipients', 'customer_id = ?', c],
    ['connection_events', 'customer_id = ?', c],
    ['feedback_messages', 'thread_id IN (' + threads + ')', c],
    ['feedback_threads', 'customer_id = ?', c],
  ];
  if (userId) {
    const u = [userId];
    steps.push(
      ['notification_reads', 'user_id = ?', u],
      ['push_deliveries', 'device_id IN (SELECT id FROM push_devices WHERE user_id = ?)', u],
      ['push_devices', 'user_id = ?', u],
      ['activity_logs', 'actor_id = ?', u],
      ['login_attempts', 'attempt_key = ?', ['user:' + userId]],
    );
  }
  steps.push(['customers', 'id = ?', c]);
  if (userId) steps.push(['users', "id = ? AND role = 'consumer'", [userId]]);
  return steps.map(([table, where, params]) => ({ table, where, params }));
}

const customerColumns = `c.id, c.user_id AS userId, c.account_number AS accountNumber,
  CONCAT_WS(' ', c.first_name, c.middle_name, c.last_name, c.extension_name) AS name,
  b.name AS barangay, c.connection_status AS status`;

function validId(value) {
  if (!/^[1-9]\d{0,19}$/.test(String(value ?? ''))) throw new AppError('Customer not found.', 404);
  return String(value);
}

export function createOwnerService({ config, db, now = () => new Date() }) {
  async function findCustomer(id, connection = db, lock = false) {
    const [[row]] = await connection.execute(
      'SELECT ' + customerColumns + ' FROM customers c JOIN barangays b ON b.id = c.barangay_id WHERE c.id = ?' +
        (lock ? ' FOR UPDATE' : ''),
      [validId(id)],
    );
    if (!row) throw new AppError('Customer not found.', 404);
    return { ...row, id: String(row.id), userId: row.userId ? String(row.userId) : null };
  }

  return {
    async login(password) {
      if (typeof password !== 'string' || !password || password.length > 1024) {
        throw new AppError('Enter the owner password.', 400);
      }
      await checkLoginAttempt(db, 'owner', async () =>
        (await verifyPassword(config.passwordHash, password))
          ? null
          : new AppError('Wrong password.', 401),
      );
      return {
        token: jwt.sign({ purpose: 'owner' }, authConfig.secret, {
          algorithm: 'HS256',
          subject: 'owner',
          expiresIn: OWNER_TOKEN_LIFETIME,
          issuer: authConfig.issuer,
          audience: OWNER_AUDIENCE,
        }),
      };
    },

    verifyToken(token) {
      try {
        const claims = jwt.verify(token, authConfig.secret, {
          algorithms: ['HS256'],
          issuer: authConfig.issuer,
          audience: OWNER_AUDIENCE,
          subject: 'owner',
        });
        if (claims.purpose !== 'owner') throw new Error('wrong purpose');
      } catch {
        throw new AppError('Session expired. Sign in again.', 401);
      }
    },

    async searchCustomers(query) {
      const text = typeof query === 'string' ? query.trim().slice(0, 80) : '';
      if (text.length < 2) return [];
      const like = '%' + text.replace(/[\\%_]/g, (ch) => '\\' + ch) + '%';
      const [rows] = await db.execute(
        'SELECT ' + customerColumns + ` FROM customers c JOIN barangays b ON b.id = c.barangay_id
        WHERE c.account_number LIKE ? OR CONCAT_WS(' ', c.first_name, c.last_name) LIKE ?
          OR CONCAT_WS(', ', c.last_name, c.first_name) LIKE ?
        ORDER BY c.last_name, c.first_name LIMIT 20`,
        [like, like, like],
      );
      return rows.map((row) => ({ ...row, id: String(row.id), userId: row.userId ? String(row.userId) : null }));
    },

    async previewCustomer(id) {
      const customer = await findCustomer(id);
      const records = [];
      for (const step of customerDeleteSteps(customer.id, customer.userId)) {
        const [[row]] = await db.execute(
          'SELECT COUNT(*) AS total FROM ' + step.table + ' WHERE ' + step.where,
          step.params,
        );
        records.push({ table: step.table, count: Number(row.total) });
      }
      return { customer, records };
    },

    async deleteCustomer(id, confirmation) {
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        const customer = await findCustomer(id, connection, true);
        if (typeof confirmation !== 'string' || confirmation.trim() !== customer.accountNumber) {
          throw new AppError('Type the account number exactly to confirm.', 400, { field: 'confirm' });
        }
        const steps = customerDeleteSteps(customer.id, customer.userId);
        const backup = { deletedAt: now().toISOString(), customer, tables: {} };
        for (const step of steps) {
          const [rows] = await connection.execute(
            'SELECT * FROM ' + step.table + ' WHERE ' + step.where,
            step.params,
          );
          if (rows.length) backup.tables[step.table] = rows;
        }
        // The backup is written before anything is removed; if writing fails, nothing is deleted.
        await mkdir(config.backupDir, { recursive: true, mode: 0o700 });
        const file = path.join(
          config.backupDir,
          backup.deletedAt.replace(/[:.]/g, '-') + '-customer-' + customer.accountNumber.replace(/[^\w-]/g, '_') + '.json',
        );
        await writeFile(file, JSON.stringify(backup, null, 2), { mode: 0o600, flag: 'wx' });
        const removed = [];
        for (const step of steps) {
          const [result] = await connection.execute(
            'DELETE FROM ' + step.table + ' WHERE ' + step.where,
            step.params,
          );
          if (result.affectedRows) removed.push({ table: step.table, count: result.affectedRows });
        }
        await connection.execute(
          `INSERT INTO activity_logs (actor_id, actor_role, action, entity_type, entity_id, description)
          VALUES (NULL, 'system', 'owner.customer.delete', 'customer', ?, ?)`,
          [customer.id, ('Owner portal permanently deleted ' + customer.accountNumber + ' ' + customer.name).slice(0, 500)],
        );
        await connection.commit();
        return { customer, removed, backupFile: path.basename(file) };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },
  };
}
