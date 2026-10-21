import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBillingSetup, billingMonth } from '../src/validators/billing-setup.validator.js';
import { today } from '../src/validators/customer.validator.js';
process.env.DB_HOST ||= '127.0.0.1';
process.env.DB_NAME ||= 'water_system_test';
process.env.DB_USER ||= 'test';
const { createBillingSetupService } = await import('../src/services/billing-setup.service.js');

const input = { barangayId: '1', month: today().slice(0, 7), due: today(), rate: '7.5' };
test('billing setup validates current PH month, real due dates and exact positive decimals', () => {
  assert.equal(validateBillingSetup(input).rate, '7.50');
  for (const change of [
    { month: '2000-01' },
    { month: '2026-13' },
    { due: '2026-02-30' },
    { due: '2000-01-01' },
    { rate: '0' },
    { rate: '-1' },
    { rate: '1e3' },
    { rate: '1.234' },
    { rate: '10000000000' },
    { barangayId: '1 OR 1=1' },
    { createdBy: '2' },
  ])
    assert.throws(() => validateBillingSetup({ ...input, ...change }), { statusCode: 400 });
  assert.throws(() => billingMonth(['2026-01']), { statusCode: 400 });
});

function fixture({ existing = null, active = true, used = false, failure = null } = {}) {
  const calls = [];
  const connection = Object.fromEntries(
    ['beginTransaction', 'commit', 'rollback', 'release'].map((name) => [
      name,
      async () => calls.push(name),
    ]),
  );
  const saved = {
    id: '8',
    barangayId: '1',
    barangay: 'Barangay Agol',
    month: input.month,
    due: input.due,
    rate: '7.50',
  };
  const model = {
    lockServiceArea: async () => ({ is_active: active ? 1 : 0 }),
    findSetup: async () => existing,
    setupInUse: async () => used,
    writeSetup: async () => {
      calls.push('write');
      return '8';
    },
    logSetup: async (id, details, actor, updated, executor) => {
      assert.equal(executor, connection);
      calls.push('audit');
      if (failure) throw failure;
    },
    listBillingSetups: async () => [saved],
  };
  return {
    service: createBillingSetupService({
      database: { getConnection: async () => connection },
      model,
    }),
    calls,
  };
}

test('setup and audit commit atomically; no-op does not write or log', async () => {
  const app = fixture();
  assert.equal((await app.service.save(input, '1')).id, '8');
  assert.deepEqual(app.calls, ['beginTransaction', 'write', 'audit', 'commit', 'release']);
  const unchanged = fixture({ existing: { id: '8', rate: '7.50', due: input.due }, used: true });
  await unchanged.service.save(input, '1');
  assert.deepEqual(unchanged.calls, ['beginTransaction', 'commit', 'release']);
});

test('used setups and inactive service areas reject changes; failures roll back', async () => {
  for (const options of [
    { active: false },
    { existing: { id: '8', rate: '5.00', due: input.due }, used: true },
    { failure: new Error('Audit unavailable') },
    { failure: Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' }) },
  ]) {
    const app = fixture(options);
    await assert.rejects(app.service.save(input, '1'));
    assert.ok(app.calls.includes('rollback'));
    assert.ok(!app.calls.includes('commit'));
    assert.equal(app.calls.at(-1), 'release');
  }
});
