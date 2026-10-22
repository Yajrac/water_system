import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeReport } from '../src/services/report.service.js';

test('reports aggregate partial payments exactly and count distinct billed accounts', () => {
  const rows = [
    {
      barangayId: '1',
      barangay: 'Caratagan',
      customerId: '1',
      total: '0.10',
      balance: '0.01',
      consumption: '0.100',
    },
    {
      barangayId: '1',
      barangay: 'Caratagan',
      customerId: '1',
      total: '0.20',
      balance: '0.20',
      consumption: '0.200',
    },
    {
      barangayId: '1',
      barangay: 'Caratagan',
      customerId: '2',
      total: '1.00',
      balance: '0.00',
      consumption: '0.001',
    },
    {
      barangayId: '2',
      barangay: 'Agol',
      customerId: '3',
      total: '9999999999999.99',
      balance: '0.00',
      consumption: '1.000',
    },
  ];
  const result = summarizeReport(rows);
  assert.deepEqual(result.summary, {
    bills: 4,
    total: '10000000000001.29',
    paid: '10000000000001.08',
    balance: '0.21',
  });
  assert.deepEqual(result.consumption[1], {
    barangay: 'Caratagan',
    accounts: 2,
    volume: '0.301',
    average: '0.151',
  });
  assert.equal(result.consumption[0].barangay, 'Agol');
});

test('empty reports have zero totals without invented records', () => {
  assert.deepEqual(summarizeReport([]), {
    summary: { bills: 0, total: '0.00', paid: '0.00', balance: '0.00' },
    consumption: [],
  });
});
