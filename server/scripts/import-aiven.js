import { readFile } from 'node:fs/promises';
import { input, password, confirm } from '@inquirer/prompts';
import mysql from 'mysql2/promise';
import { preparePhpMyAdminImport } from '../src/database/phpmyadmin-import.js';

// Run manually against a new, empty Aiven database. Local .env is never loaded.
async function main() {
  const [sqlPath, caPath] = process.argv.slice(2);
  if (!sqlPath || !caPath) {
    throw new Error('Usage: node scripts/import-aiven.js "path/to/export.sql" "path/to/ca.pem"');
  }
  const sql = await readFile(sqlPath, 'utf8');
  const ca = await readFile(caPath, 'utf8');
  if (!sql.includes('-- phpMyAdmin SQL Dump')) throw new Error('Expected a phpMyAdmin SQL export.');
  if (/^\s*(?:USE\s|(?:CREATE|DROP|ALTER)\s+DATABASE\b|DELIMITER\b)/im.test(sql)) {
    throw new Error('Export must not switch databases or contain database commands or DELIMITER.');
  }
  const importSql = preparePhpMyAdminImport(sql);
  const host = (await input({ message: 'Aiven Host (from Overview):' })).trim();
  if (!host.endsWith('.aivencloud.com')) throw new Error('Enter your Aiven host ending in .aivencloud.com.');
  const port = Number(await input({ message: 'Aiven Port:' }));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port.');
  const user = (await input({ message: 'Aiven User:', default: 'avnadmin' })).trim();
  const secret = await password({ message: 'Aiven Password:', mask: '*' });
  const database = 'water_system';
  const connection = await mysql.createConnection({
    host, port, user, password: secret, database,
    ssl: { ca, rejectUnauthorized: true },
    multipleStatements: true, connectTimeout: 20000, charset: 'utf8mb4',
  });
  try {
    const [existing] = await connection.query('SHOW TABLES');
    if (existing.length) throw new Error('Import refused: water_system already contains tables. Nothing was imported.');
    console.log('Connected securely. Target: ' + host + ':' + port + '/' + database);
    if (!(await confirm({ message: 'Import this SQL export into the empty online water_system database?', default: false }))) return;
    console.log('Importing tables and data...');
    await connection.query(importSql);
    const [tables] = await connection.query('SHOW TABLES');
    console.log('Import completed. Tables: ' + tables.length + '. Local XAMPP was not modified.');
  } catch (error) {
    // MySQL DDL auto-commits: never promise rollback or automatically delete partial imports.
    console.error('Import stopped. If it had started, the target may contain partially imported tables.');
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  if (error.name === 'ExitPromptError') console.error('Import cancelled.');
  else console.error('Import failed: ' + (error.code || error.message));
  process.exitCode = 1;
});
