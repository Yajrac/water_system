import { readFile } from 'node:fs/promises';
import { input, password, confirm } from '@inquirer/prompts';
import mysql from 'mysql2/promise';
import { readMigrations } from '../src/database/files.js';
import { runDatabaseCommand } from '../src/database/runner.js';

// Uses existing migration history; never imports a dump or changes local .env.
let connection;
try {
  const caPath = process.argv[2];
  if (!caPath || process.argv.length !== 3)
    throw new Error('Usage: node scripts/migrate-aiven.js "path/to/ca.pem"');
  const ca = await readFile(caPath, 'utf8');
  const host = (await input({ message: 'Aiven Host:' })).trim();
  if (!host.endsWith('.aivencloud.com'))
    throw new Error('Enter your Aiven host ending in .aivencloud.com.');
  const port = Number(await input({ message: 'Aiven Port:' }));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port.');
  const user = (await input({ message: 'Aiven User:', default: 'avnadmin' })).trim();
  const secret = await password({ message: 'Aiven Password:', mask: '*' });
  connection = await mysql.createConnection({
    host,
    port,
    user,
    password: secret,
    database: 'water_system',
    ssl: { ca, rejectUnauthorized: true },
    multipleStatements: true,
  });
  const files = await readMigrations();
  console.log('Target: ' + host + ':' + port + '/water_system');
  await runDatabaseCommand(connection, files, 'status');
  if (
    await confirm({
      message: 'Apply pending migrations to this online water_system database?',
      default: false,
    })
  ) {
    await runDatabaseCommand(connection, files, 'migrate');
  }
} catch (error) {
  console.error('Migration stopped: ' + (error.code || error.message));
  process.exitCode = 1;
} finally {
  if (connection) await connection.end();
}
