import { databaseOptions } from '../src/config/database.js';
import { readMigrations, baselineThrough } from '../src/database/files.js';
import { runDatabaseCommand } from '../src/database/runner.js';

const [command, ...args] = process.argv.slice(2);
let connection;
try {
  if (!['status', 'migrate', 'baseline', 'seed-office'].includes(command)) {
    throw new Error('Choose status, migrate, baseline or seed-office.');
  }
  if (
    command === 'baseline'
      ? args.length !== 2 || args[0] !== '--through' || args[1] !== baselineThrough
      : args.length > 0
  ) {
    throw new Error('Unexpected arguments. Baseline requires --through ' + baselineThrough);
  }
  const files = await readMigrations();
  const options = await databaseOptions();
  const { default: mysql } = await import('mysql2/promise');
  // Multiple statements are restricted to this trusted, local migration CLI.
  // Future API connections must leave multipleStatements disabled.
  connection = await mysql.createConnection({ ...options, multipleStatements: true });
  await connection.query("SET time_zone = '+00:00'");
  console.log('Database: ' + options.database + ' at ' + options.host + ':' + options.port);
  await runDatabaseCommand(connection, files, command, { through: args[1] });
} catch (error) {
  console.error(error.sql ? 'Database command failed: ' + error.code : error.message);
  process.exitCode = 1;
} finally {
  if (connection) await connection.end();
}
