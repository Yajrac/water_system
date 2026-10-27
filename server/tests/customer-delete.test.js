import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_HOST ||= '127.0.0.1';
process.env.DB_USER ||= 'test';
process.env.DB_NAME ||= 'test';
const { deletionIds, deleteCustomers } = await import('../src/services/customer-delete.service.js');

test('customer deletion rejects empty, duplicate, oversized and unsafe selections', () => {
  for (const body of [null, {}, { ids: [] }, { ids: ['1', '1'] }, { ids: ['0'] },
    { ids: [1] }, { ids: ['1 OR 1=1'] }, { ids: ['18446744073709551616'] },
    { ids: Array.from({ length: 101 }, (_, i) => String(i + 1)) }, { ids: ['1'], all: true }])
    assert.throws(() => deletionIds(body), { statusCode: 400 });
  assert.deepEqual(deletionIds({ ids: ['20', '3'] }), ['3', '20']);
});

function database({ missing = false, role = 'consumer', failAudit = false } = {}) {
  const calls = [];
  const connection = {
    async beginTransaction() { calls.push('begin'); },
    async commit() { calls.push('commit'); },
    async rollback() { calls.push('rollback'); },
    release() { calls.push('release'); },
    async execute(sql, values) {
      calls.push({ sql, values });
      if (sql.startsWith('SELECT id, user_id')) return [missing ? [] : [{ id: '2', user_id: '8', account_number: 'ACC-2' }]];
      if (sql.startsWith('SELECT role')) return [[{ role }]];
      if (failAudit && sql.startsWith('INSERT INTO activity_logs')) throw new Error('audit unavailable');
      return [{ affectedRows: 1 }];
    },
  };
  return { calls, async getConnection() { return connection; } };
}

test('deletion commits customer cleanup and audit together without deleting configuration', async () => {
  const db = database();
  assert.deepEqual(await deleteCustomers({ ids: ['2'] }, '1', db), { count: 1 });
  assert.deepEqual(db.calls.slice(-2), ['commit', 'release']);
  const sql = db.calls.filter((item) => item.sql).map((item) => item.sql);
  assert.ok(sql.findIndex((s) => s.startsWith('DELETE p FROM payments')) < sql.findIndex((s) => s.startsWith('DELETE FROM bills')));
  assert.ok(sql.some((s) => s.startsWith('UPDATE activity_logs SET actor_id=NULL')));
  assert.ok(!sql.some((s) => /^DELETE FROM (barangays|billing_setups|office_settings|activity_logs)/.test(s)));
});

test('missing selections, nonconsumer accounts and audit failures roll back the entire deletion', async () => {
  for (const options of [{ missing: true }, { role: 'admin' }, { failAudit: true }]) {
    const db = database(options);
    await assert.rejects(deleteCustomers({ ids: ['2'] }, '1', db));
    assert.ok(!db.calls.includes('commit'));
    assert.deepEqual(db.calls.slice(-2), ['rollback', 'release']);
    if (!options.failAudit) assert.ok(!db.calls.some((item) => item.sql?.startsWith('DELETE')));
  }
});
