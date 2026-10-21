import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePayment, validatePaymentQuery } from '../src/validators/payment.validator.js';
import { today } from '../src/validators/customer.validator.js';
process.env.DB_HOST ||= '127.0.0.1';
process.env.DB_NAME ||= 'water_system_test';
process.env.DB_USER ||= 'test';
const { createPaymentService } = await import('../src/services/payment.service.js');
const input = {
  billId: '1',
  amount: '40',
  expectedBalance: '100',
  method: 'Cash',
  requestKey: 'payment-request-123456',
};

test('payments require exact positive decimals, supported methods and safe references', () => {
  assert.equal(validatePayment(input).amount, '40.00');
  for (const change of [
    { amount: 0 },
    { amount: '-1' },
    { amount: '1e3' },
    { amount: '1.234' },
    { amount: [1] },
    { amount: '10000000000000' },
    { billId: '1 OR 1=1' },
    { method: 'GCash' },
    { method: 'Bank transfer', reference: '' },
    { requestKey: 'short' },
    { receipt: 'FAKE' },
    { remarks: '<script>' },
  ])
    assert.throws(() => validatePayment({ ...input, ...change }), { statusCode: 400 });
  assert.throws(() => validatePaymentQuery({ from: '2026-02-30' }), { statusCode: 400 });
  assert.throws(() => validatePaymentQuery({ from: '2026-02-02', to: '2026-02-01' }), {
    statusCode: 400,
  });
});

function fixture(options = {}) {
  const calls = [];
  const connection = Object.fromEntries(
    ['beginTransaction', 'commit', 'rollback', 'release'].map((name) => [
      name,
      async () => calls.push(name),
    ]),
  );
  const row = {
    id: '2',
    billId: '1',
    customerId: '3',
    amount: '40.00',
    balanceBefore: '100.00',
    receipt: 'OR-TEST',
    total: '100.00',
  };
  const model = {
    lockBill: async () => ({ total: '100.00', generatedOn: today() }),
    paidForBill: async () => options.paid || '0.00',
    findRequest: async () => options.previous || null,
    insertPayment: async () => {
      calls.push('payment+audit');
      if (options.fail) throw new Error('Audit failed');
      return '2';
    },
    getReceipt: async () => ({ row, office: { name: 'Water office' } }),
  };
  return {
    calls,
    service: createPaymentService({ model, database: { getConnection: async () => connection } }),
  };
}

test('partial payment commits with receipt and exact remaining balance; audit failure rolls back', async () => {
  const app = fixture();
  assert.equal((await app.service.save(input, '1')).payment.balanceAfter, '60.00');
  assert.deepEqual(app.calls, ['beginTransaction', 'payment+audit', 'commit', 'release']);
  const failed = fixture({ fail: true });
  await assert.rejects(failed.service.save(input, '1'));
  assert.ok(failed.calls.includes('rollback'));
  assert.ok(!failed.calls.includes('commit'));
});

test('idempotent retries return the same receipt; stale balance and key reuse do not charge', async () => {
  const previous = {
    id: '2',
    billId: '1',
    actorId: '1',
    amount: '40.00',
    method: 'Cash',
    reference: '',
    remarks: '',
  };
  const retry = fixture({ previous, paid: '100.00' });
  assert.equal((await retry.service.save(input, '1')).payment.receipt, 'OR-TEST');
  assert.ok(!retry.calls.includes('payment+audit'));
  for (const options of [
    { paid: '1.00' },
    { paid: '100.00' },
    { previous: { ...previous, amount: '20.00' } },
    { previous: { ...previous, actorId: '2' } },
  ]) {
    const app = fixture(options);
    await assert.rejects(app.service.save(input, '1'), { statusCode: 409 });
    assert.ok(!app.calls.includes('payment+audit'));
  }
  const overpaid = fixture();
  await assert.rejects(overpaid.service.save({ ...input, amount: '100.01' }, '1'), {
    statusCode: 400,
  });
});
