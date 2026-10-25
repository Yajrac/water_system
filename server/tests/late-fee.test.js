import test from 'node:test';
import assert from 'node:assert/strict';
process.env.DB_HOST ||= '127.0.0.1';
process.env.DB_NAME ||= 'water_system_test';
process.env.DB_USER ||= 'test';
const { suggestLateFee, recordLateFee } = await import('../src/services/late-fee.service.js');
const bill = { id: '1', customerId: '1', total: '100.00', due: '2026-10-01', generated: '2026-09-20' };
const data = () => ({ bills: [{ ...bill }], payments: [], assessments: [] });

test('late-fee suggestion starts on day 7 and compounds every 7 Philippine calendar days', () => {
  assert.equal(suggestLateFee(data(), '2026-10-07').amount, '0.00');
  assert.equal(suggestLateFee(data(), '2026-10-08').amount, '10.00');
  assert.equal(suggestLateFee(data(), '2026-10-14').amount, '10.00');
  assert.equal(suggestLateFee(data(), '2026-10-15').amount, '21.00');
  assert.equal(suggestLateFee(data(), '2026-10-22').amount, '33.10');
  assert.equal(suggestLateFee(data(), '2026-10-22').amount, '33.10', 'reading a suggestion never adds a charge');
});

test('partial payments affect only boundaries after the payment; fully paid bills have no new fee', () => {
  const input = data();
  input.payments.push({ billId: '1', amount: '40.00', day: '2026-10-07' });
  assert.equal(suggestLateFee(input, '2026-10-08').amount, '6.00');
  input.payments[0].day = '2026-10-09';
  assert.equal(suggestLateFee(input, '2026-10-15').amount, '17.00');
  input.payments[0] = { billId: '1', amount: '100.00', day: '2026-10-07' };
  assert.equal(suggestLateFee(input, '2026-11-01').amount, '0.00');
});

test('billed fee periods are not charged twice, while unpaid carried penalties compound', () => {
  const input = data();
  input.bills.push({ id: '2', customerId: '1', total: '60.00', due: '2026-11-01', generated: '2026-10-08' });
  input.assessments.push({ id: '1', sourceBillId: '1', chargedBillId: '2', amount: '10.00', through: '2026-10-08' });
  assert.equal(suggestLateFee(input, '2026-10-08').amount, '0.00');
  assert.equal(suggestLateFee(input, '2026-10-15').amount, '11.00');
  input.payments.push({ billId: '2', day: '2026-10-14', amount: '60.00' });
  assert.equal(suggestLateFee(input, '2026-10-15').amount, '10.00', 'paid carried penalties stop accruing');
  input.payments.push({ billId: '1', day: '2026-10-14', amount: '100.00' });
  assert.equal(suggestLateFee(input, '2026-10-15').amount, '0.00');
});

test('waived periods stay waived and future ordinary charges are not overdue', () => {
  const input = data();
  input.bills.push({ id: '2', customerId: '1', total: '50.00', due: '2026-11-01', generated: '2026-10-08' });
  input.assessments.push({ id: '1', sourceBillId: '1', chargedBillId: '2', amount: '0.00', through: '2026-10-08' });
  assert.equal(suggestLateFee(input, '2026-10-08').amount, '0.00');
  assert.equal(suggestLateFee(input, '2026-10-15').amount, '10.00');
});

test('cent rounding and excessive accrued balances are bounded', () => {
  const input = data();
  input.bills[0].total = '0.05';
  assert.equal(suggestLateFee(input, '2026-10-08').amount, '0.01');
  input.bills[0].total = '9999999999999.99';
  assert.throws(() => suggestLateFee(input, '2026-10-08'), { statusCode: 400 });
});

test('generation records the admin approved amount and refuses a previously consumed checkpoint', async () => {
  const suggestion = suggestLateFee(data(), '2026-10-15');
  const writes = [];
  let checkpoint = bill.due;
  const connection = { async execute(sql, values) {
    if (sql.startsWith('SELECT')) return [[{ through: checkpoint }]];
    writes.push(values);
    checkpoint = values[2];
    return [{}];
  } };
  const entry = { id: '5', late: '5.00', lateFeeBasis: JSON.stringify(suggestion.basis) };
  await recordLateFee(entry, '1', connection);
  assert.equal(writes[0][3], '5.00', 'manual adjustment wins over the suggestion');
  await assert.rejects(recordLateFee(entry, '1', connection), { statusCode: 409 });
  assert.equal(writes.length, 1);
});
