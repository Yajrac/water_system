import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_HOST ||= '127.0.0.1';
process.env.DB_NAME ||= 'water_system_test';
process.env.DB_USER ||= 'test';

const { validateBarangay, validateBarangayId } =
  await import('../src/validators/barangay.validator.js');
const { createBarangayService } = await import('../src/services/barangay.service.js');
const input = { psgcCode: '0500513001', name: 'Barangay Agol' };
const stored = {
  id: '1',
  psgc_code: input.psgcCode,
  name: input.name,
  municipality: 'Pio Duran',
  province: 'Albay',
  is_active: 1,
};

function fixture({
  existing = stored,
  duplicate = null,
  used = false,
  insertError,
  logError,
  deleteError,
} = {}) {
  const calls = [];
  const connection = {
    beginTransaction: async () => calls.push('begin'),
    commit: async () => calls.push('commit'),
    rollback: async () => calls.push('rollback'),
    release: () => calls.push('release'),
  };
  const model = {
    deleteBarangay: async (id, executor) => {
      assert.equal(executor, connection);
      calls.push('delete');
      if (deleteError) throw deleteError;
    },
    lockBarangayById: async () => existing,
    isBarangayInUse: async () => used,
    findConflictingBarangay: async () => duplicate,
    createBarangay: async (details, executor) => {
      assert.equal(executor, connection);
      calls.push('insert');
      if (insertError) throw insertError;
      return { ...stored, name: details.name };
    },
    updateBarangay: async (id, details, executor) => {
      assert.equal(executor, connection);
      calls.push('update');
      return { ...stored, id, name: details.name, psgc_code: details.psgcCode };
    },
  };
  const service = createBarangayService({
    database: {
      getConnection: async () => {
        calls.push('connect');
        return connection;
      },
    },
    model,
    recordActivity: async (executor, actorId, action) => {
      assert.equal(executor, connection);
      assert.equal(actorId, '9');
      calls.push(action);
      if (logError) throw logError;
    },
  });
  return { service, calls };
}

test('barangay validator matches official code/name and returns canonical display names', () => {
  assert.deepEqual(validateBarangay({ psgcCode: ' 0500513001 ', name: ' agol ' }), {
    psgcCode: '0500513001',
    name: 'Barangay Agol',
    municipality: 'Pio Duran',
    province: 'Albay',
  });
  assert.equal(validateBarangay({ psgcCode: '0500513023', name: 'Barangay I' }).name, 'Barangay 1');
});

test('barangay validator rejects untrusted fields, unknown codes and mismatched names', () => {
  for (const body of [
    null,
    [],
    {},
    { ...input, is_active: 1 },
    { ...input, psgcCode: '0500513999' },
    { ...input, name: 'Barangay Rawis' },
    { ...input, municipality: 'Other town' },
    { ...input, name: 123 },
  ]) {
    assert.throws(() => validateBarangay(body), { statusCode: 400 });
  }
  for (const id of ['0', '-1', '1 OR 1=1', '1.2', '18446744073709551616', 1]) {
    assert.throws(() => validateBarangayId(id), { statusCode: 400 });
  }
});

test('invalid data never obtains a database connection', async () => {
  const { service, calls } = fixture();
  await assert.rejects(service.addBarangay({}, '9'), { statusCode: 400 });
  assert.deepEqual(calls, []);
});

test('create and audit log commit together on the same connection', async () => {
  const { service, calls } = fixture();
  assert.equal((await service.addBarangay(input, '9')).name, 'Barangay Agol');
  assert.deepEqual(calls, ['connect', 'begin', 'insert', 'barangay.created', 'commit', 'release']);
});

test('duplicate precheck and concurrent unique violation return 409 and roll back', async () => {
  for (const options of [{ duplicate: { id: '2' } }, { insertError: { code: 'ER_DUP_ENTRY' } }]) {
    const { service, calls } = fixture(options);
    await assert.rejects(service.addBarangay(input, '9'), { statusCode: 409 });
    assert.ok(calls.includes('rollback'));
    assert.ok(!calls.includes('commit'));
    assert.equal(calls.at(-1), 'release');
  }
});

test('barangay service exposes no edit operation', () => {
  assert.equal(fixture().service.editBarangay, undefined);
});

test('audit failure rolls back the business write', async () => {
  const error = new Error('Audit insert failed');
  const { service, calls } = fixture({ logError: error });
  await assert.rejects(service.addBarangay(input, '9'), (caught) => caught === error);
  assert.ok(calls.includes('rollback'));
  assert.ok(!calls.includes('commit'));
  assert.equal(calls.at(-1), 'release');
});

test('delete commits with its audit event; missing or linked rows are protected', async () => {
  const success = fixture();
  assert.deepEqual(await success.service.removeBarangay('1', '9'), { id: '1' });
  assert.deepEqual(success.calls, [
    'connect',
    'begin',
    'delete',
    'barangay.unregistered',
    'commit',
    'release',
  ]);
  for (const [options, statusCode] of [
    [{ existing: null }, 404],
    [{ used: true }, 409],
  ]) {
    const item = fixture(options);
    await assert.rejects(item.service.removeBarangay('1', '9'), { statusCode });
    assert.ok(!item.calls.includes('delete'));
    assert.ok(item.calls.includes('rollback'));
  }
});

test('delete handles foreign key races and rolls back when logging fails', async () => {
  const race = fixture({ deleteError: { code: 'ER_ROW_IS_REFERENCED_2' } });
  await assert.rejects(race.service.removeBarangay('1', '9'), { statusCode: 409 });
  const failure = new Error('Audit unavailable');
  const item = fixture({ logError: failure });
  await assert.rejects(item.service.removeBarangay('1', '9'), (error) => error === failure);
  assert.ok(item.calls.includes('rollback'));
  assert.ok(!item.calls.includes('commit'));
});
