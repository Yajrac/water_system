import test from 'node:test';
import assert from 'node:assert/strict';

// Standalone tests never load .env or connect to a real database.
process.env.DB_HOST ||= '127.0.0.1';
process.env.DB_NAME ||= 'water_system_test';
process.env.DB_USER ||= 'test';

const { resetForgottenPassword, validateForgotPassword } = await import('../src/services/forgot-password.service.js');
const { verifyPassword } = await import('../src/utils/password.js');

function fakeDb({ users = [{ id: 7, is_active: 1 }], recentResets = 0 } = {}) {
  const calls = [];
  const state = { committed: false, rolledBack: false, released: false };
  const connection = {
    async beginTransaction() {},
    async commit() { state.committed = true; },
    async rollback() { state.rolledBack = true; },
    release() { state.released = true; },
    async execute(sql, values) {
      calls.push({ sql, values });
      if (/FROM customers c JOIN users u/.test(sql)) return [users];
      if (/COUNT\(\*\) AS total FROM activity_logs/.test(sql)) return [[{ total: recentResets }]];
      return [{ affectedRows: 1 }];
    },
  };
  return { db: { getConnection: async () => connection }, calls, state };
}

test('validates account number and new password length', () => {
  assert.throws(() => validateForgotPassword({ accountNumber: ' ', newPassword: 'longenough' }), { statusCode: 400 });
  assert.throws(() => validateForgotPassword({ accountNumber: 'A-1', newPassword: 'short' }), { statusCode: 400 });
  assert.deepEqual(validateForgotPassword({ accountNumber: ' A-1 ', newPassword: 'longenough' }), {
    accountNumber: 'A-1', newPassword: 'longenough',
  });
});

test('resets the password, signs out old sessions and writes an audit entry', async () => {
  const { db, calls, state } = fakeDb();
  const result = await resetForgottenPassword({ accountNumber: 'A-001', newPassword: 'brand-new-pass' }, db);
  assert.deepEqual(result, { reset: true, signInRequired: true });
  const update = calls.find((call) => call.sql.startsWith('UPDATE users'));
  assert.match(update.sql, /auth_version = auth_version \+ 1/);
  assert.match(update.sql, /must_change_password = 0/);
  assert.equal(update.values[1], 7);
  assert.ok(await verifyPassword(update.values[0], 'brand-new-pass'));
  const audit = calls.find((call) => call.sql.includes('INSERT INTO activity_logs'));
  assert.equal(audit.values[1], 'consumer.password_reset');
  assert.ok(state.committed && state.released && !state.rolledBack);
});

test('unknown, ambiguous or inactive accounts are rejected without changes', async () => {
  for (const users of [[], [{ id: 1, is_active: 1 }, { id: 2, is_active: 1 }], [{ id: 3, is_active: 0 }]]) {
    const { db, calls, state } = fakeDb({ users });
    await assert.rejects(resetForgottenPassword({ accountNumber: 'X', newPassword: 'brand-new-pass' }, db), { statusCode: 400 });
    assert.ok(!calls.some((call) => call.sql.startsWith('UPDATE users')));
    assert.ok(state.rolledBack && state.released);
  }
});

test('stops after three resets for the same account within a day', async () => {
  const { db, calls } = fakeDb({ recentResets: 3 });
  await assert.rejects(resetForgottenPassword({ accountNumber: 'A-001', newPassword: 'brand-new-pass' }, db), { statusCode: 429 });
  assert.ok(!calls.some((call) => call.sql.startsWith('UPDATE users')));
});
