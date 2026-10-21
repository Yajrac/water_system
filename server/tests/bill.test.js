import test from 'node:test';
import assert from 'node:assert/strict';
import {
  billAmounts,
  validateBillQuery,
  validateGeneration,
} from '../src/validators/bill.validator.js';
import { today } from '../src/validators/customer.validator.js';
process.env.DB_HOST ||= '127.0.0.1';
process.env.DB_NAME ||= 'water_system_test';
process.env.DB_USER ||= 'test';
const { createBillService } = await import('../src/services/bill.service.js');
const setup = {
  id: '1',
  barangayId: '1',
  active: 1,
  month: today().slice(0, 7),
  due: today(),
  rate: '7.00',
};
const customer = {
  id: '2',
  barangayId: '1',
  meterId: '3',
  previous: '400.000',
  serviceStatus: 'Installed',
  connectionStatus: 'Active',
};
const entry = {
  id: '4',
  meterId: '3',
  previous: '400.000',
  current: '500.000',
  consumption: '100.000',
  connectionCharge: '0.00',
  late: '0.00',
  other: '0.00',
  status: 'Saved',
};

test('bill charges use exact half-up rounding and enforce database bounds', () => {
  assert.equal(billAmounts(entry, '7.00').total, '700.00');
  assert.equal(billAmounts({ ...entry, consumption: '0.001' }, '5.00').water, '0.01');
  assert.equal(
    billAmounts({ ...entry, consumption: '0.100', connectionCharge: '0.10' }, '0.10').total,
    '0.11',
  );
  assert.throws(() => billAmounts({ ...entry, consumption: '999999999999.999' }, '9999999999.99'), {
    statusCode: 400,
  });
  assert.throws(() => validateGeneration({ setupId: '1', total: '0' }), { statusCode: 400 });
  assert.throws(() => validateGeneration({ setupId: '1' }, true), { statusCode: 409 });
  for (const query of [{ status: 'invalid' }, { due: '2026-02-30' }, { limit: '1000' }])
    assert.throws(() => validateBillQuery(query), { statusCode: 400 });
});

function fixture(options = {}) {
  const calls = [];
  const connection = Object.fromEntries(
    ['beginTransaction', 'commit', 'rollback', 'release'].map((name) => [
      name,
      async () => calls.push(name),
    ]),
  );
  const model = {
    findSetup: async () => ({ ...setup, ...(options.setup || {}) }),
    listConsumers: async () => (options.empty ? [] : [customer]),
    lockConsumer: async () => ({ ...customer, ...(options.customer || {}) }),
    findEntry: async () => (options.missing ? null : { ...entry, ...(options.entry || {}) }),
    hasBill: async () => Boolean(options.billed),
    insertBill: async (s, c, e, amounts, actor, day, executor) => {
      assert.equal(executor, connection);
      assert.equal(amounts.total, '700.00');
      calls.push('bill+meter');
      if (options.fail) throw new Error('Write failed');
    },
    logGeneration: async () => calls.push('audit'),
  };
  return {
    calls,
    service: createBillService({ model, database: { getConnection: async () => connection } }),
  };
}

test('preview writes nothing; generation atomically commits bills, meter changes and audit', async () => {
  const app = fixture();
  const preview = await app.service.preview({ setupId: '1' });
  assert.deepEqual(app.calls, ['beginTransaction', 'commit', 'release']);
  app.calls.length = 0;
  const result = await app.service.generate({ setupId: '1', revision: preview.revision }, '1');
  assert.equal(result.count, 1);
  assert.deepEqual(app.calls, ['beginTransaction', 'bill+meter', 'audit', 'commit', 'release']);
  const failure = fixture({ fail: true });
  await assert.rejects(failure.service.generate({ setupId: '1', revision: preview.revision }, '1'));
  assert.ok(failure.calls.includes('rollback'));
  assert.ok(!failure.calls.includes('commit'));
});

test('missing entries, stale preview, billed accounts and changed meters cannot generate', async () => {
  const preview = await fixture().service.preview({ setupId: '1' });
  for (const options of [
    { missing: true },
    { empty: true },
    { billed: true },
    { entry: { status: 'Billed' } },
    { customer: { previous: '401.000' } },
    { setup: { rate: '8.00' } },
    { setup: { month: '2000-01' } },
  ]) {
    const app = fixture(options);
    await assert.rejects(app.service.generate({ setupId: '1', revision: preview.revision }, '1'), {
      statusCode: 409,
    });
    assert.ok(!app.calls.includes('bill+meter'));
    assert.ok(app.calls.includes('rollback'));
  }
});
