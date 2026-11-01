import test from 'node:test';
import assert from 'node:assert/strict';
process.env.DB_HOST ||= '127.0.0.1';
process.env.DB_NAME ||= 'water_system_test';
process.env.DB_USER ||= 'test';
const { automaticLateFeePlan, createAutomaticLateFees } = await import('../src/services/automatic-late-fee.service.js');
const bill = { id: '1', due: '2026-10-28', total: '100.00', late: '0.00', next: null };

test('first 10% is due the next day, then every seven days, compounding exact cents', () => {
  assert.equal(automaticLateFeePlan(bill, [], '2026-10-28').events.length, 0);
  const first = automaticLateFeePlan(bill, [], '2026-10-29');
  assert.equal(first.total, '110.00');
  assert.equal(first.next, '2026-11-05');
  assert.equal(automaticLateFeePlan(bill, [], '2026-11-04').total, '110.00');
  const catchup = automaticLateFeePlan(bill, [], '2026-11-12');
  assert.equal(catchup.total, '133.10');
  assert.deepEqual(catchup.events.map((row) => row.amount), ['10.00', '11.00', '12.10']);
  assert.equal(automaticLateFeePlan({ ...bill, total: '0.05' }, [], '2026-10-29').total, '0.06');
});

test('partial payments reduce the next period, not earlier periods, and paid bills stay paid', () => {
  const payment = { amount: '40.00', day: '2026-11-01' };
  const plan = automaticLateFeePlan(bill, [payment], '2026-11-05');
  assert.equal(plan.late, '17.00');
  assert.equal(plan.total, '117.00');
  assert.equal(automaticLateFeePlan(bill, [{ ...payment, day: '2026-10-28' }], '2026-10-29').late, '6.00');
  assert.equal(automaticLateFeePlan(bill, [{ amount: '100.00', day: '2026-10-28' }], '2027-01-01').events.length, 0);
  assert.equal(automaticLateFeePlan(bill, [{ amount: '100.00', day: '2026-10-30' }], '2027-01-01').events.length, 0,
    'legacy fully paid records are never reopened retrospectively');
});

test('persisted checkpoints and legacy assessed periods are never charged twice', () => {
  const initial = automaticLateFeePlan(bill, [], '2026-10-29');
  const saved = { ...bill, ...initial };
  assert.equal(automaticLateFeePlan(saved, [], '2026-11-04').events.length, 0);
  assert.equal(automaticLateFeePlan(saved, [], '2026-11-05').total, '121.00');
  const legacy = automaticLateFeePlan({ ...bill, legacyThrough: '2026-11-04' }, [], '2026-11-05');
  assert.deepEqual(legacy.events.map((row) => row.day), ['2026-11-05']);
  assert.equal(legacy.late, '10.00');
});

test('accrued late fee and total reject overflow instead of silently truncating money', () => {
  assert.throws(() => automaticLateFeePlan({ ...bill, late: '9999999999.99' }, [], '2026-10-29'), { statusCode: 409 });
  assert.throws(() => automaticLateFeePlan({ ...bill, total: '9999999999999.99' }, [], '2026-10-29'), { statusCode: 409 });
});

function fixture({ failure = false } = {}) {
  let stored = { ...bill };
  const events = [];
  const calls = [];
  let unlock = Promise.resolve();
  const database = {
    async getConnection() {
      let releaseLock;
      let snapshot;
      let length;
      return {
        async beginTransaction() {
          const previous = unlock;
          unlock = new Promise((resolve) => { releaseLock = resolve; });
          await previous;
          snapshot = { ...stored };
          length = events.length;
          calls.push('begin');
        },
        async execute(sql, values) {
          if (sql.includes('FROM bills WHERE')) { assert.match(sql, /FOR UPDATE/); return [[{ ...stored }]]; }
          if (sql.includes('FROM payments')) { assert.match(sql, /FOR UPDATE/); return [[]]; }
          if (sql.includes('MAX(through_date)')) return [[{ through: null }]];
          if (sql.includes('INSERT INTO bill_late_fee_events')) {
            if (failure) throw new Error('Write failed');
            assert.equal(events.some((row) => row[1] === values[1]), false);
            events.push(values);
            return [{}];
          }
          if (sql.startsWith('UPDATE bills')) {
            [stored.late, stored.total, stored.next] = values;
            return [{}];
          }
          throw new Error('Unexpected SQL: ' + sql);
        },
        async commit() { calls.push('commit'); },
        async rollback() { stored = snapshot; events.length = length; calls.push('rollback'); },
        release() { releaseLock(); calls.push('release'); },
      };
    },
  };
  return { fees: createAutomaticLateFees({ database, date: () => '2026-11-05' }), events, calls,
    stored: () => stored };
}

test('two simultaneous updates serialize on the bill and each overdue period posts only once', async () => {
  const app = fixture();
  await Promise.all([app.fees.accrueBill('1'), app.fees.accrueBill('1')]);
  assert.equal(app.stored().total, '121.00');
  assert.equal(app.stored().late, '21.00');
  assert.equal(app.events.length, 2);
  assert.equal(app.calls.filter((call) => call === 'commit').length, 2);
});

test('failed automatic assessment rolls back bill changes and period events together', async () => {
  const app = fixture({ failure: true });
  await assert.rejects(app.fees.accrueBill('1'), /Write failed/);
  assert.equal(app.stored().total, '100.00');
  assert.equal(app.events.length, 0);
  assert.ok(app.calls.includes('rollback'));
  assert.equal(app.calls.at(-1), 'release');
});
