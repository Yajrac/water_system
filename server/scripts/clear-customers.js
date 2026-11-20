// Clears customer records from the database configured in server/.env (local or VPS).
// Keeps admin accounts, barangays, billing setups, office settings, admin activity logs
// and migration history. Run from server/: node --env-file=.env scripts/clear-customers.js
import { input, confirm } from '@inquirer/prompts';
import mysql from 'mysql2/promise';

import { databaseOptions } from '../src/config/database.js';

// Deleted in this order so no foreign key blocks a delete.
const steps = [
  ['payments', 'DELETE FROM payments'],
  ['bill_late_fee_events', 'DELETE FROM bill_late_fee_events'],
  ['late_fee_assessments', 'DELETE FROM late_fee_assessments'],
  ['bills', 'DELETE FROM bills'],
  ['meter_entries', 'DELETE FROM meter_entries'],
  ['water_meters', 'DELETE FROM water_meters'],
  ['application_documents', 'DELETE FROM application_documents'],
  ['application_estimates', 'DELETE FROM application_estimates'],
  ['customer_applications', 'DELETE FROM customer_applications'],
  ['announcement_recipients', 'DELETE FROM announcement_recipients'],
  ['connection_events', 'DELETE FROM connection_events'],
  ['feedback_messages', 'DELETE FROM feedback_messages'],
  ['feedback_threads', 'DELETE FROM feedback_threads'],
  // Consumer app accounts and what refers to them.
  ['notification_reads (consumers)',
    "DELETE FROM notification_reads WHERE user_id IN (SELECT id FROM users WHERE role = 'consumer')"],
  ['push_deliveries (consumers)',
    "DELETE FROM push_deliveries WHERE device_id IN (SELECT d.id FROM push_devices d JOIN users u ON u.id = d.user_id WHERE u.role = 'consumer')"],
  ['push_devices (consumers)',
    "DELETE FROM push_devices WHERE user_id IN (SELECT id FROM users WHERE role = 'consumer')"],
  ['activity_logs (consumer actions)',
    "DELETE FROM activity_logs WHERE actor_id IN (SELECT id FROM users WHERE role = 'consumer')"],
  ['login_attempts (consumers)',
    "DELETE FROM login_attempts WHERE attempt_key IN (SELECT CONCAT('user:', id) FROM users WHERE role = 'consumer')"],
  ['customers', 'DELETE FROM customers'],
  ['users (consumer accounts)', "DELETE FROM users WHERE role = 'consumer'"],
];

// COUNT(*) form of each DELETE, for the preview.
const countSql = (sql) => sql.replace(/^DELETE FROM/, 'SELECT COUNT(*) AS records FROM');

let connection;
let transaction = false;
try {
  connection = await mysql.createConnection({ ...(await databaseOptions()), multipleStatements: false });
  const [[target]] = await connection.query('SELECT DATABASE() AS name, @@hostname AS host');
  console.log('Target database: ' + target.name + ' on ' + target.host);
  for (const [label, sql] of steps) {
    const [[row]] = await connection.query(countSql(sql));
    console.log('  ' + label + ': ' + row.records);
  }
  console.log('\nDeletes ALL records listed above, including bills, payments and consumer app logins.');
  console.log('Keeps admin accounts, barangays, billing setups, office settings, admin activity logs and migrations.');
  const accepted = await confirm({
    message: 'Database backup saved and ready to permanently clear these customer records?',
    default: false,
  });
  if (!accepted) {
    console.log('Cancelled. Nothing deleted.');
  } else if ((await input({ message: 'Type CLEAR CUSTOMERS to confirm:' })) !== 'CLEAR CUSTOMERS') {
    console.log('Confirmation did not match. Nothing deleted.');
  } else {
    await connection.beginTransaction();
    transaction = true;
    for (const [label, sql] of steps) {
      const [result] = await connection.query(sql);
      console.log('  ' + label + ': removed ' + result.affectedRows);
    }
    await connection.commit();
    transaction = false;
    console.log('Cleanup committed.');
  }
} catch (error) {
  if (transaction) {
    await connection.rollback();
    console.error('Cleanup rolled back. Nothing was deleted.');
  }
  console.error('Cleanup stopped: ' + (error.code || error.message));
  process.exitCode = 1;
} finally {
  if (connection) await connection.end();
}
