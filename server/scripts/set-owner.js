// Creates the owner portal password hash and secret link.
// Run from server/: node scripts/set-owner.js
// Paste the printed lines into server/.env, then restart the API.
import { randomBytes } from 'node:crypto';
import { password, confirm } from '@inquirer/prompts';

import { hashPassword } from '../src/utils/password.js';

const first = await password({
  message: 'Owner password (at least 12 characters):',
  mask: '*',
  validate: (value) => value.length >= 12 || 'Use at least 12 characters.',
});
const again = await password({ message: 'Type it again:', mask: '*' });
if (first !== again) {
  console.error('Passwords did not match. Nothing changed.');
  process.exit(1);
}
const keepPath =
  process.env.OWNER_PORTAL_PATH &&
  (await confirm({ message: 'Keep the current secret link?', default: true }));
const portalPath = keepPath ? process.env.OWNER_PORTAL_PATH : randomBytes(24).toString('base64url');

console.log('\nAdd or replace these lines in server/.env:\n');
console.log('OWNER_PORTAL_PATH=' + portalPath);
console.log("OWNER_PASSWORD_HASH='" + (await hashPassword(first)) + "'");
console.log('\nSecret link after restart:');
console.log('  https://<your-domain>/api/v1/owner/' + portalPath + '/');
