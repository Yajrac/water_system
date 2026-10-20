import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { baselineThrough, officeSeed, validateHistory } from './files.js';
import { inspectBaseline } from './schema.js';

const historyDDL = `CREATE TABLE IF NOT EXISTS schema_migrations (
  name VARCHAR(255) NOT NULL,
  checksum CHAR(64) NOT NULL,
  status ENUM('running', 'applied', 'baseline', 'failed') NOT NULL,
  applied_at TIMESTAMP NULL,
  PRIMARY KEY (name)
) ENGINE = InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

async function historyExists(connection) {
  const [tables] = await connection.execute(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schema_migrations'",
  );
  return tables.length > 0;
}

async function readHistory(connection) {
  if (!(await historyExists(connection))) return [];
  const [rows] = await connection.query(
    'SELECT name, checksum, status FROM schema_migrations ORDER BY name',
  );
  return rows;
}

export async function runDatabaseCommand(
  connection,
  files,
  command,
  options = {},
  log = console.log,
) {
  if (command === 'status') {
    const history = await readHistory(connection);
    validateHistory(files, history);
    const known = new Map(history.map((row) => [row.name, row.status]));
    for (const file of files) log((known.get(file.name) || 'pending') + '  ' + file.name);
    return;
  }

  const [[database]] = await connection.query('SELECT DATABASE() AS name');
  const lock =
    'pwss-migrate-' + createHash('sha256').update(database.name).digest('hex').slice(0, 40);
  const [[result]] = await connection.execute('SELECT GET_LOCK(?, 10) AS acquired', [lock]);
  if (Number(result.acquired) !== 1)
    throw new Error('Another database command is running. Try again later.');
  try {
    const history = await readHistory(connection);
    const pending = validateHistory(files, history);
    if (command === 'baseline') {
      // The cutoff is explicit, so future migrations cannot accidentally be skipped.
      if (options.through !== baselineThrough) {
        throw new Error('Baseline requires --through ' + baselineThrough);
      }
      if (history.length)
        throw new Error('Baseline is only for an untracked database. Run db:status instead.');
      const cutoff = files.findIndex((file) => file.name === baselineThrough);
      if (cutoff !== 15) throw new Error('Expected the original 16 migration files for baseline.');
      const initial = files.slice(0, cutoff + 1);
      const count = await inspectBaseline(connection, initial);
      await connection.query(historyDDL);
      await connection.beginTransaction();
      try {
        for (const file of initial) {
          await connection.execute(
            "INSERT INTO schema_migrations (name, checksum, status, applied_at) VALUES (?, ?, 'baseline', CURRENT_TIMESTAMP)",
            [file.name, file.checksum],
          );
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      }
      log(
        'Verified ' +
          count +
          ' existing tables. Recorded 16 baseline migrations; business tables and data were not modified.',
      );
      return;
    }

    if (command === 'seed-office') {
      if (pending.length)
        throw new Error('Apply or baseline all migrations before seeding office settings.');
      await connection.beginTransaction();
      try {
        await connection.query(await readFile(officeSeed, 'utf8'));
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      }
      log('Office seed complete. Existing office details were preserved.');
      return;
    }

    if (command !== 'migrate') throw new Error('Unknown database command.');
    if (!history.length) {
      const [tables] = await connection.query(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME <> 'schema_migrations'",
      );
      if (tables.length)
        throw new Error(
          'Existing untracked tables found. Use db:baseline for the verified initial schema.',
        );
    }
    await connection.query(historyDDL);
    for (const file of pending) {
      await connection.execute(
        "INSERT INTO schema_migrations (name, checksum, status) VALUES (?, ?, 'running')",
        [file.name, file.checksum],
      );
      try {
        // DDL implicitly commits in MySQL/MariaDB. Never claim this is rollback-safe.
        await connection.query(file.sql);
        await connection.execute(
          "UPDATE schema_migrations SET status = 'applied', applied_at = CURRENT_TIMESTAMP WHERE name = ?",
          [file.name],
        );
      } catch (error) {
        try {
          await connection.execute(
            "UPDATE schema_migrations SET status = 'failed' WHERE name = ?",
            [file.name],
          );
        } catch {
          // If the connection broke, the durable 'running' row still blocks automatic retry.
        }
        throw new Error(
          'Migration stopped at ' +
            file.name +
            ' (' +
            (error.code || 'database error') +
            '). DDL may be partially applied. Inspect and repair before retrying.',
        );
      }
      log('applied  ' + file.name);
    }
    if (!pending.length) log('Database migrations are up to date.');
  } finally {
    await connection.execute('SELECT RELEASE_LOCK(?)', [lock]);
  }
}
