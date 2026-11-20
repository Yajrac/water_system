import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';

// Standalone tests never load .env or connect to a real database.
process.env.JWT_SECRET ||= randomBytes(48).toString('hex');
process.env.DB_HOST ||= '127.0.0.1';
process.env.DB_NAME ||= 'water_system_test';
process.env.DB_USER ||= 'test';

const { readOwnerConfig } = await import('../src/config/owner.js');
const { customerDeleteSteps, createOwnerService } = await import('../src/services/owner.service.js');
const { createAuthenticate } = await import('../src/middleware/authenticate.js');
const { authConfig } = await import('../src/config/auth.js');
const { hashPassword } = await import('../src/utils/password.js');

const customer = {
  id: '7', userId: '42', accountNumber: 'PD-0007', name: 'Maria Santos', barangay: 'Agol', status: 'Active',
};

test('owner portal stays off until both settings exist, and rejects weak settings', () => {
  assert.equal(readOwnerConfig({}), null);
  assert.throws(() => readOwnerConfig({ OWNER_PORTAL_PATH: 'short', OWNER_PASSWORD_HASH: '$argon2id$x' }));
  assert.throws(() => readOwnerConfig({ OWNER_PORTAL_PATH: 'a'.repeat(32) }));
  assert.throws(() => readOwnerConfig({ OWNER_PORTAL_PATH: 'a'.repeat(32), OWNER_PASSWORD_HASH: 'plain' }));
  const config = readOwnerConfig({ OWNER_PORTAL_PATH: 'a'.repeat(32), OWNER_PASSWORD_HASH: '$argon2id$v=19$x' });
  assert.equal(config.portalPath, 'a'.repeat(32));
});

test('customer delete removes children before the rows they reference', () => {
  const order = customerDeleteSteps('7', '42').map((step) => step.table);
  const before = (child, parent) =>
    assert.ok(order.indexOf(child) < order.indexOf(parent), child + ' must be deleted before ' + parent);
  before('payments', 'bills');
  before('bill_late_fee_events', 'bills');
  before('late_fee_assessments', 'bills');
  before('late_fee_assessments', 'meter_entries');
  before('bills', 'meter_entries');
  before('meter_entries', 'water_meters');
  before('water_meters', 'customer_applications');
  before('application_documents', 'customer_applications');
  before('application_estimates', 'customer_applications');
  before('feedback_messages', 'feedback_threads');
  before('push_deliveries', 'push_devices');
  before('activity_logs', 'users');
  before('customers', 'users');
  assert.equal(order.at(-1), 'users');
  // Without an app login, no user rows are touched.
  const noLogin = customerDeleteSteps('7', null).map((step) => step.table);
  for (const table of ['users', 'push_devices', 'activity_logs', 'login_attempts']) assert.ok(!noLogin.includes(table));
  assert.equal(noLogin.at(-1), 'customers');
});

function fakeDb({ failOn } = {}) {
  const events = [];
  const connection = {
    async beginTransaction() { events.push('begin'); },
    async execute(sql, params) {
      if (sql.startsWith('SELECT c.id')) {
        return [[{ ...customer }]];
      }
      if (sql.startsWith('SELECT * FROM')) {
        const table = sql.split(' ')[3];
        return [table === 'bills' ? [{ id: '1', customer_id: '7', total_amount: '150.00' }] : []];
      }
      if (sql.startsWith('DELETE FROM')) {
        const table = sql.split(' ')[2];
        if (table === failOn) throw new Error('foreign key');
        events.push('delete ' + table);
        return [{ affectedRows: table === 'bills' || table === 'customers' ? 1 : 0 }];
      }
      if (sql.startsWith('INSERT INTO activity_logs')) {
        events.push('log ' + params[1]);
        return [{}];
      }
      throw new Error('unexpected SQL: ' + sql);
    },
    async commit() { events.push('commit'); },
    async rollback() { events.push('rollback'); },
    release() { events.push('release'); },
  };
  return { events, db: { getConnection: async () => connection, execute: connection.execute } };
}

test('delete needs the exact account number and leaves everything when it does not match', async () => {
  const backupDir = await mkdtemp(path.join(os.tmpdir(), 'owner-'));
  try {
    const { events, db } = fakeDb();
    const service = createOwnerService({ config: { backupDir }, db });
    await assert.rejects(service.deleteCustomer('7', 'PD-0008'), { statusCode: 400 });
    await assert.rejects(service.deleteCustomer('7', undefined), { statusCode: 400 });
    assert.ok(!events.some((event) => event.startsWith('delete') || event === 'commit'));
    assert.deepEqual(await readdir(backupDir), []);
    await assert.rejects(service.deleteCustomer('abc', 'PD-0007'), { statusCode: 404 });
  } finally {
    await rm(backupDir, { recursive: true, force: true });
  }
});

test('delete writes a backup first, removes every table in one transaction and logs it', async () => {
  const backupDir = await mkdtemp(path.join(os.tmpdir(), 'owner-'));
  try {
    const { events, db } = fakeDb();
    const service = createOwnerService({ config: { backupDir }, db, now: () => new Date('2026-11-21T08:00:00Z') });
    const result = await service.deleteCustomer('7', ' PD-0007 ');
    assert.equal(result.removed.map((row) => row.table + '=' + row.count).join(','), 'bills=1,customers=1');
    const deletes = events.filter((event) => event.startsWith('delete')).map((event) => event.slice(7));
    assert.equal(deletes.join(','), customerDeleteSteps('7', '42').map((step) => step.table).join(','));
    assert.equal(events.at(-3).startsWith('log Owner portal permanently deleted PD-0007'), true);
    assert.equal(events.at(-2), 'commit');
    const [file] = await readdir(backupDir);
    assert.equal(file, result.backupFile);
    const backup = JSON.parse(await readFile(path.join(backupDir, file), 'utf8'));
    assert.equal(backup.customer.accountNumber, 'PD-0007');
    assert.equal(backup.tables.bills[0].total_amount, '150.00');
  } finally {
    await rm(backupDir, { recursive: true, force: true });
  }
});

test('a failed delete rolls back the whole transaction', async () => {
  const backupDir = await mkdtemp(path.join(os.tmpdir(), 'owner-'));
  try {
    const { events, db } = fakeDb({ failOn: 'water_meters' });
    const service = createOwnerService({ config: { backupDir }, db });
    await assert.rejects(service.deleteCustomer('7', 'PD-0007'), /foreign key/);
    assert.ok(events.includes('rollback'));
    assert.ok(!events.includes('commit'));
    assert.equal(events.at(-1), 'release');
  } finally {
    await rm(backupDir, { recursive: true, force: true });
  }
});

test('owner login issues a token only the owner portal accepts', async () => {
  const state = { failures: 0, locked_until: null, now: new Date() };
  const connection = {
    async beginTransaction() {},
    async execute(sql, values) {
      if (sql.startsWith('SELECT')) return [[{ ...state }]];
      if (sql.startsWith('UPDATE')) { state.failures = values[0]; state.locked_until = values[1]; }
      return [[]];
    },
    async commit() {},
    async rollback() {},
    release() {},
  };
  const db = { getConnection: async () => connection };
  const service = createOwnerService({ config: { passwordHash: await hashPassword('correct horse battery') }, db });
  await assert.rejects(service.login('wrong password!'), { statusCode: 401 });
  assert.equal(state.failures, 1);
  await assert.rejects(service.login(''), { statusCode: 400 });
  const { token } = await service.login('correct horse battery');
  assert.equal(state.failures, 0);
  service.verifyToken(token);

  // The admin/consumer API refuses the owner token.
  const authenticate = createAuthenticate(async () => assert.fail('must not look up a user'));
  const req = { get: () => 'Bearer ' + token, originalUrl: '/api/v1/customers' };
  const res = { set() {}, vary() {} };
  await assert.rejects(authenticate(req, res, () => {}), { statusCode: 401 });

  // The owner portal refuses an admin token.
  const adminToken = jwt.sign({ role: 'admin', version: 0 }, authConfig.secret, {
    algorithm: 'HS256', subject: '1', expiresIn: '15m', issuer: authConfig.issuer, audience: authConfig.audience,
  });
  assert.throws(() => service.verifyToken(adminToken), { statusCode: 401 });
});
