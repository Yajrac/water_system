import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMeterEntry, entryRevision } from '../src/validators/meter-entry.validator.js';
import { today } from '../src/validators/customer.validator.js';

process.env.DB_HOST ||= '127.0.0.1';
process.env.DB_NAME ||= 'water_system_test';
process.env.DB_USER ||= 'test';
const { createMeterEntryService } = await import('../src/services/meter-entry.service.js');
const body = { setupId: '1', customerId: '2', meterId: '4', previous: '400', consumption: '100' };
const entry = {
  id: '3',
  customerId: '2',
  meterId: '4',
  previous: '400.000',
  consumption: '100.000',
  current: '500.000',
  status: 'Saved',
  recordedBy: '1',
};

test('meter entry only accepts bounded decimals, valid IDs and explicit consumption', () => {
  assert.equal(validateMeterEntry(body).consumption, '100.000');
  assert.equal(validateMeterEntry({ ...body, consumption: '0' }).consumption, '0.000');
  for (const changes of [
    { consumption: '' },
    { consumption: '-1' },
    { consumption: '1.1234' },
    { previous: '999999999999.999', consumption: '0.001' },
    { other: '1e3' },
    { current: '500' },
    { consumption: [1] },
    { setupId: '1 OR 1=1' },
    { revision: 'stale' },
  ])
    assert.throws(() => validateMeterEntry({ ...body, ...changes }));
});

function fixture(options = {}) {
  const calls = [];
  const connection = Object.fromEntries(
    ['beginTransaction', 'commit', 'rollback', 'release'].map((name) => [
      name,
      async () => calls.push(name),
    ]),
  );
  const consumer = {
    id: '2',
    barangayId: '1',
    meterId: '4',
    previous: options.previous || '400.000',
    connectionStatus: options.inactive ? 'Inactive' : 'Active',
    serviceStatus: 'Installed',
  };
  const model = {
    findSetup: async () => ({
      id: '1',
      barangayId: '1',
      month: options.old ? '2000-01' : today().slice(0, 7),
      active: 1,
    }),
    lockConsumer: async () => consumer,
    hasBill: async () => Boolean(options.billed),
    findEntry: async () => options.entry || null,
    saveEntry: async (details, customer, actor, existing, executor) => {
      assert.equal(executor, connection);
      assert.equal(details.consumption, '100.000');
      calls.push('write');
      if (options.fail) throw new Error('Write or audit failed');
      return entry;
    },
  };
  return {
    calls,
    service: createMeterEntryService({
      model,
      database: { getConnection: async () => connection },
    }),
  };
}

test('saving commits an entry and returns the database generated current reading', async () => {
  const app = fixture();
  const result = await app.service.save(body, '1');
  assert.equal(result.current, '500.000');
  assert.equal(result.revision, entryRevision(entry));
  assert.deepEqual(app.calls, ['beginTransaction', 'write', 'commit', 'release']);
});

test('stale reading, duplicate save, billed or ineligible meters reject without writing', async () => {
  for (const options of [
    { previous: '401.000' },
    { old: true },
    { inactive: true },
    { billed: true },
    { entry },
    { entry: { ...entry, status: 'Billed' } },
  ]) {
    const app = fixture(options);
    await assert.rejects(app.service.save(body, '1'), { statusCode: 409 });
    assert.ok(!app.calls.includes('write'));
    assert.ok(app.calls.includes('rollback'));
  }
  const editing = fixture({ entry });
  await editing.service.save({ ...body, revision: entryRevision(entry) }, '1');
  assert.ok(editing.calls.includes('commit'));
  const failure = fixture({ fail: true });
  await assert.rejects(failure.service.save(body, '1'));
  assert.ok(failure.calls.includes('rollback'));
  assert.equal(failure.calls.at(-1), 'release');
});
