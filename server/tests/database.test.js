import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checksum,
  readMigrations,
  validateHistory,
  baselineThrough,
} from '../src/database/files.js';
import { initialTables, inspectBaseline } from '../src/database/schema.js';
import { runDatabaseCommand } from '../src/database/runner.js';
import { databaseOptions } from '../src/config/database.js';

const allFiles = await readMigrations();
const files = allFiles.slice(0, 16);
const tables = initialTables(files);

// Metadata double reproducing the MariaDB result shapes used by baseline.
function databaseDouble({ existing = true, history = [], mutate, failDDL = false } = {}) {
  const calls = [];
  let tracked = history.length > 0;
  let ddlCount = 0;
  const run = async (sql, values = []) => {
    calls.push({ sql, values });
    const table = tables.find((item) => item.name === values[0]);
    let rows;
    if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }]];
    if (sql.includes('RELEASE_LOCK')) return [[{ released: 1 }]];
    if (sql === 'SELECT DATABASE() AS name') return [[{ name: 'water_system' }]];
    if (sql.includes("TABLE_NAME = 'schema_migrations'"))
      return [tracked ? [{ TABLE_NAME: 'schema_migrations' }] : []];
    if (sql.startsWith('SELECT name, checksum, status'))
      return [history.map((row) => ({ ...row }))];
    if (sql.includes("TABLE_NAME <> 'schema_migrations'"))
      return [existing ? [{ TABLE_NAME: 'users' }] : []];
    if (sql.includes('information_schema.TABLES')) {
      rows = existing && table ? [{ ENGINE: 'InnoDB', TABLE_COLLATION: 'utf8mb4_unicode_ci' }] : [];
    } else if (sql.includes('information_schema.COLUMNS')) {
      rows = table.columns.map((column) => ({
        COLUMN_NAME: column.name,
        COLUMN_TYPE: column.type.replace(/^bigint\b/, 'bigint(20)'),
        IS_NULLABLE: column.nullable ? 'YES' : 'NO',
        COLUMN_DEFAULT:
          column.default === 'CURRENT_TIMESTAMP'
            ? 'current_timestamp()'
            : column.default == null
              ? 'NULL'
              : `'${column.default}'`,
        EXTRA: [
          column.autoIncrement ? 'auto_increment' : '',
          column.onUpdate ? 'on update current_timestamp()' : '',
          column.generated ? 'STORED GENERATED' : '',
        ].join(' '),
        GENERATION_EXPRESSION: column.generated ? '`previous_reading` + `consumption`' : null,
      }));
    } else if (sql.includes('information_schema.STATISTICS')) {
      rows = table.indexes.flatMap((index) =>
        index.columns.map((column, position) => ({
          INDEX_NAME: index.name,
          NON_UNIQUE: index.unique ? 0 : 1,
          COLUMN_NAME: column,
          SEQ_IN_INDEX: position + 1,
          SUB_PART: null,
        })),
      );
    } else if (sql.includes('information_schema.KEY_COLUMN_USAGE')) {
      rows = table.foreignKeys.map((key) => ({
        CONSTRAINT_NAME: key.name,
        COLUMN_NAME: key.column,
        REFERENCED_TABLE_NAME: key.table,
        REFERENCED_COLUMN_NAME: key.referencedColumn,
        DELETE_RULE: 'RESTRICT',
        UPDATE_RULE: 'RESTRICT',
      }));
    } else if (sql.includes('information_schema.CHECK_CONSTRAINTS')) {
      rows = [{ CONSTRAINT_NAME: 'chk_office_settings_singleton', CHECK_CLAUSE: '`id` = 1' }];
    } else if (sql.startsWith('CREATE TABLE IF NOT EXISTS schema_migrations')) {
      tracked = true;
    } else if (sql.startsWith('INSERT INTO schema_migrations')) {
      history.push({
        name: values[0],
        checksum: values[1],
        status: sql.includes("'baseline'") ? 'baseline' : 'running',
      });
    } else if (sql.startsWith('UPDATE schema_migrations')) {
      history.find((item) => item.name === values[0]).status = sql.includes("'failed'")
        ? 'failed'
        : 'applied';
    } else if (sql.startsWith('CREATE TABLE ')) {
      ddlCount++;
      if (failDDL) throw Object.assign(new Error('DDL interrupted'), { code: 'ER_TEST_FAILURE' });
    }
    if (rows) {
      mutate?.(sql, values, rows);
      return [rows];
    }
    return [{}];
  };
  return {
    calls,
    history,
    query: run,
    execute: run,
    beginTransaction: async () => calls.push({ sql: 'BEGIN' }),
    commit: async () => calls.push({ sql: 'COMMIT' }),
    rollback: async () => calls.push({ sql: 'ROLLBACK' }),
    get ddlCount() {
      return ddlCount;
    },
  };
}

test('initial migrations reproduce 18 tables, 30 foreign keys and decimal consumption generation', () => {
  assert.equal(files.length, 16);
  assert.equal(files.at(-1).name, baselineThrough);
  assert.equal(tables.length, 18);
  assert.equal(
    tables.reduce((sum, table) => sum + table.foreignKeys.length, 0),
    30,
  );
  const created = new Set();
  for (const table of tables) {
    for (const key of table.foreignKeys)
      assert.ok(created.has(key.table), table.name + ' references an unavailable table');
    created.add(table.name);
  }
  assert.equal(
    tables
      .find((table) => table.name === 'meter_entries')
      .columns.find((column) => column.name === 'current_reading').generated,
    'previous_reading+consumption',
  );
});

test('checksums tolerate Windows line endings but detect edited SQL', () => {
  assert.equal(checksum('SELECT 1;\n'), checksum('SELECT 1;\r\n'));
  assert.notEqual(checksum('SELECT 1;'), checksum('SELECT 2;'));
});

test('history rejects changed files, incomplete migrations, missing files and out-of-order history', () => {
  const row = { name: files[0].name, checksum: files[0].checksum, status: 'applied' };
  assert.equal(validateHistory(files, [row]).length, 15);
  assert.throws(() => validateHistory(files, [{ ...row, checksum: 'edited' }]), /changed/);
  assert.throws(() => validateHistory(files, [{ ...row, status: 'running' }]), /Incomplete/);
  assert.throws(() => validateHistory(files, [{ ...row, status: 'failed' }]), /Incomplete/);
  assert.throws(() => validateHistory(files, [{ ...row, name: files[1].name }]), /ordered prefix/);
  assert.throws(() => validateHistory([], [row]), /ordered prefix/);
});

test('status reads history without creating tables or taking a write lock', async () => {
  const connection = databaseDouble();
  const lines = [];
  await runDatabaseCommand(connection, files, 'status', {}, (line) => lines.push(line));
  assert.equal(lines.length, 16);
  assert.ok(connection.calls.every(({ sql }) => sql.startsWith('SELECT')));
});

test('baseline verifies existing schema and records history without running business DDL', async () => {
  const connection = databaseDouble();
  await runDatabaseCommand(connection, files, 'baseline', { through: baselineThrough }, () => {});
  assert.equal(connection.history.length, 16);
  assert.ok(connection.history.every((row) => row.status === 'baseline'));
  assert.equal(connection.ddlCount, 0);
  assert.ok(connection.calls.some(({ sql }) => sql === 'COMMIT'));
});

test('baseline leaves future migrations pending and requires the explicit initial cutoff', async () => {
  const future = {
    name: '017_add_column.sql',
    sql: 'ALTER TABLE users ADD example INT;',
    checksum: 'future',
  };
  const connection = databaseDouble();
  await runDatabaseCommand(
    connection,
    [...files, future],
    'baseline',
    { through: baselineThrough },
    () => {},
  );
  assert.deepEqual(validateHistory([...files, future], connection.history), [future]);
  await assert.rejects(
    runDatabaseCommand(databaseDouble(), files, 'baseline', {}, () => {}),
    /requires --through/,
  );
});

test('baseline refuses drift without recording history', async () => {
  for (const kind of [
    'column',
    'default',
    'index',
    'foreign key',
    'generated',
    'check',
    'engine',
  ]) {
    const connection = databaseDouble({
      mutate(sql, values, rows) {
        if (kind === 'column' && values[0] === 'users' && sql.includes('.COLUMNS')) rows.pop();
        if (kind === 'default' && values[0] === 'users' && sql.includes('.COLUMNS'))
          rows.find((row) => row.COLUMN_NAME === 'is_active').COLUMN_DEFAULT = '0';
        if (kind === 'index' && values[0] === 'users' && sql.includes('.STATISTICS')) rows.pop();
        if (
          kind === 'foreign key' &&
          values[0] === 'customers' &&
          sql.includes('.KEY_COLUMN_USAGE')
        )
          rows.pop();
        if (kind === 'generated' && values[0] === 'meter_entries' && sql.includes('.COLUMNS'))
          rows.find((row) => row.COLUMN_NAME === 'current_reading').GENERATION_EXPRESSION =
            'previous_reading - consumption';
        if (kind === 'check' && sql.includes('.CHECK_CONSTRAINTS')) rows.length = 0;
        if (kind === 'engine' && values[0] === 'users' && sql.includes('.TABLES'))
          rows[0].ENGINE = 'MyISAM';
      },
    });
    await assert.rejects(
      runDatabaseCommand(connection, files, 'baseline', { through: baselineThrough }, () => {}),
      /Baseline refused/,
      kind,
    );
    assert.equal(connection.history.length, 0);
    assert.equal(connection.ddlCount, 0);
  }
});

test('baseline accepts string-valued index metadata returned with bigNumberStrings', async () => {
  const connection = databaseDouble({
    mutate(sql, values, rows) {
      if (!sql.includes('information_schema.STATISTICS')) return;
      for (const row of rows) {
        row.NON_UNIQUE = String(row.NON_UNIQUE);
        row.SEQ_IN_INDEX = String(row.SEQ_IN_INDEX);
      }
    },
  });
  await runDatabaseCommand(connection, files, 'baseline', { through: baselineThrough }, () => {});
  assert.equal(connection.history.length, 16);
});

test('baseline still rejects a non-unique index in place of a unique index', async () => {
  const connection = databaseDouble({
    mutate(sql, values, rows) {
      if (values[0] === 'users' && sql.includes('information_schema.STATISTICS')) {
        rows.find((row) => row.INDEX_NAME === 'uq_users_username').NON_UNIQUE = '1';
      }
    },
  });
  await assert.rejects(
    runDatabaseCommand(connection, files, 'baseline', { through: baselineThrough }, () => {}),
    /different index uq_users_username/,
  );
  assert.equal(connection.history.length, 0);
});

test('baseline refuses missing tables', async () => {
  await assert.rejects(
    inspectBaseline(databaseDouble({ existing: false }), files),
    /missing table/,
  );
});

test('migrate refuses existing untracked tables', async () => {
  const connection = databaseDouble();
  await assert.rejects(
    runDatabaseCommand(connection, files, 'migrate', {}, () => {}),
    /untracked tables/,
  );
  assert.equal(connection.ddlCount, 0);
});

test('empty database migration applies once and repeat is a no-op', async () => {
  const connection = databaseDouble({ existing: false });
  await runDatabaseCommand(connection, files, 'migrate', {}, () => {});
  assert.equal(connection.ddlCount, 16);
  assert.equal(connection.history.length, 16);
  await runDatabaseCommand(connection, files, 'migrate', {}, () => {});
  assert.equal(connection.ddlCount, 16);
});

test('failed DDL is recorded and cannot be retried automatically', async () => {
  const connection = databaseDouble({ existing: false, failDDL: true });
  await assert.rejects(
    runDatabaseCommand(connection, files, 'migrate', {}, () => {}),
    /partially applied/,
  );
  assert.equal(connection.history[0].status, 'failed');
  await assert.rejects(
    runDatabaseCommand(connection, files, 'migrate', {}, () => {}),
    /Incomplete migration/,
  );
  assert.equal(connection.ddlCount, 1);
});

test('office seed is explicit and blocked before migrations', async () => {
  await assert.rejects(
    runDatabaseCommand(databaseDouble(), files, 'seed-office', {}, () => {}),
    /before seeding/,
  );
  const history = files.map((file) => ({
    name: file.name,
    checksum: file.checksum,
    status: 'baseline',
  }));
  const connection = databaseDouble({ history });
  await runDatabaseCommand(connection, files, 'seed-office', {}, () => {});
  assert.ok(connection.calls.some(({ sql }) => sql.startsWith('INSERT INTO office_settings')));
});

test('configuration rejects missing variables and invalid ports', async () => {
  await assert.rejects(databaseOptions({}), /DB_HOST/);
  await assert.rejects(
    databaseOptions({ DB_HOST: 'localhost', DB_NAME: 'test', DB_USER: 'test', DB_PORT: '0' }),
    /DB_PORT/,
  );
  const options = await databaseOptions({ DB_HOST: 'localhost', DB_NAME: 'test', DB_USER: 'test' });
  assert.equal(options.port, 3306);
  assert.equal(options.multipleStatements, undefined);
});

test('temporary-password migration follows the original baseline', () => {
  assert.equal(allFiles[16].name, '017_add_temporary_consumer_password.sql');
  assert.match(allFiles[16].sql, /ADD COLUMN must_change_password/);
  assert.match(allFiles[16].sql, /ADD COLUMN auth_version/);
});
