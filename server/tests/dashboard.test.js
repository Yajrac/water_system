import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardPeriod, createDashboardService } from '../src/services/dashboard.service.js';
import { readDashboard } from '../src/models/dashboard.model.js';

test('dashboard six-month window crosses calendar years correctly', () => {
  const period = dashboardPeriod('2026-02-03');
  assert.deepEqual(period.months, [
    '2025-09',
    '2025-10',
    '2025-11',
    '2025-12',
    '2026-01',
    '2026-02',
  ]);
  assert.equal(period.start, '2025-09-01');
  assert.equal(period.end, '2026-03-01');
});

test('dashboard fills missing months and preserves exact monetary strings', async () => {
  const get = createDashboardService({
    date: () => '2026-02-03',
    read: async () => ({
      customers: { totalCustomers: '2', registeredCustomers: '1' },
      areas: { barangays: '1', activeBarangays: '1' },
      billing: {
        bills: '3',
        unpaidBills: '2',
        paid: '1',
        unpaid: '1',
        overdue: '1',
        outstanding: '9999999999999.99',
      },
      payments: { totalCollections: '0.01', todayCollections: '0.00', monthCollections: '0.01' },
      collections: [{ month: '2026-02', amount: '0.01' }],
      consumption: [{ barangayId: '1', barangay: 'Agol', volume: '0.000' }],
    }),
  });
  const data = await get();
  assert.equal(data.summary.totalCustomers, 2);
  assert.equal(data.summary.outstanding, '9999999999999.99');
  assert.deepEqual(
    data.monthlyCollections.map((row) => row.amount),
    ['0.00', '0.00', '0.00', '0.00', '0.00', '0.01'],
  );
  assert.equal(
    data.billStatuses.reduce((sum, row) => sum + row.count, 0),
    3,
  );
});

test('dashboard rolls back and releases its connection after query failure', async () => {
  const events = [];
  const failure = new Error('query failed');
  const connection = {
    beginTransaction: async () => events.push('begin'),
    query: async () => {
      throw failure;
    },
    rollback: async () => events.push('rollback'),
    release: () => events.push('release'),
  };
  await assert.rejects(
    readDashboard(dashboardPeriod('2026-02-03'), { getConnection: async () => connection }),
    failure,
  );
  assert.deepEqual(events, ['begin', 'rollback', 'release']);
});
