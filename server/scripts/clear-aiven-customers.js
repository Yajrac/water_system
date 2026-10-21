import { readFile } from 'node:fs/promises';
import { input, password, confirm } from '@inquirer/prompts';
import mysql from 'mysql2/promise';

// Fixed scope: customer records only. User accounts and configuration remain.
const tables = [
  'payments', 'bills', 'meter_entries', 'water_meters',
  'application_documents', 'application_estimates', 'customer_applications',
  'connection_events', 'feedback_messages', 'feedback_threads', 'customers',
];

let connection;
let transaction = false;
try {
  if (process.argv.length !== 3)
    throw new Error('Usage: node scripts/clear-aiven-customers.js "path/to/ca.pem"');
  const ca = await readFile(process.argv[2], 'utf8');
  const host = (await input({ message: 'Aiven Host:' })).trim();
  if (!host.endsWith('.aivencloud.com')) throw new Error('Expected an Aiven host.');
  const port = Number(await input({ message: 'Aiven Port:', default: '10512' }));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port.');
  const user = (await input({ message: 'Aiven User:', default: 'avnadmin' })).trim();
  const secret = await password({ message: 'Aiven Password:', mask: '*' });
  connection = await mysql.createConnection({
    host, port, user, password: secret, database: 'water_system',
    ssl: { ca, rejectUnauthorized: true },
    multipleStatements: false,
  });
  console.log('Target: ' + host + ':' + port + '/water_system');
  // Refuse nontransactional tables so any failed deletion can be rolled back.
  for (const table of tables) {
    const [metadata] = await connection.execute(
      'SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
      [table],
    );
    if (metadata.length !== 1 || metadata[0].ENGINE !== 'InnoDB')
      throw new Error('Missing or nontransactional table: ' + table);
    const [[row]] = await connection.query('SELECT COUNT(*) AS records FROM `' + table + '`');
    console.log(table + ': ' + row.records);
  }
  console.log('Deletes ALL records listed above, including bills and payments.');
  console.log('Keeps tables, user/login accounts, barangays, settings and activity logs.');
  const accepted = await confirm({
    message: 'Backup saved and ready to permanently clear these online customer records?',
    default: false,
  });
  if (!accepted) {
    console.log('Cancelled. Nothing deleted.');
  } else if ((await input({ message: 'Type CLEAR ONLINE CUSTOMERS to confirm:' })) !== 'CLEAR ONLINE CUSTOMERS') {
    console.log('Confirmation did not match. Nothing deleted.');
  } else {
    await connection.beginTransaction();
    transaction = true;
    for (const table of tables) {
      const [result] = await connection.query('DELETE FROM `' + table + '`');
      console.log(table + ': removed ' + result.affectedRows);
    }
    await connection.commit();
    transaction = false;
    console.log('Cleanup committed. Local XAMPP was not modified.');
  }
} catch (error) {
  if (transaction) {
    await connection.rollback();
    console.error('Cleanup rolled back.');
  }
  console.error('Cleanup stopped: ' + (error.code || error.message));
  process.exitCode = 1;
} finally {
  if (connection) await connection.end();
}
