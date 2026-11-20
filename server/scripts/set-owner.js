// Sets the owner portal password and secret link, and saves both to server/.env.
// Run from server/: node scripts/set-owner.js   (then restart the API)
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { password, confirm } from '@inquirer/prompts';

import { hashPassword } from '../src/utils/password.js';

const envFile = new URL('../.env', import.meta.url);
let text;
try {
  text = await readFile(envFile, 'utf8');
} catch {
  console.error('server/.env not found. Create it first (see .env.example). Nothing changed.');
  process.exit(1);
}
const current = (key) => new RegExp('^' + key + "=['\"]?([^'\"\\r\\n]*)", 'm').exec(text)?.[1]?.trim();

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
const existingPath = current('OWNER_PORTAL_PATH');
const keepPath = existingPath && (await confirm({ message: 'Keep the current secret link?', default: true }));
const portalPath = keepPath ? existingPath : randomBytes(24).toString('base64url');
const values = {
  OWNER_PORTAL_PATH: portalPath,
  OWNER_PASSWORD_HASH: "'" + (await hashPassword(first)) + "'",
};

// Replace existing lines, or add them at the end.
for (const [key, value] of Object.entries(values)) {
  const line = key + '=' + value;
  const pattern = new RegExp('^' + key + '=.*$', 'm');
  text = pattern.test(text) ? text.replace(pattern, () => line) : text.replace(/\n*$/, '\n') + line + '\n';
}
await writeFile(envFile, text);

const origin = (current('CORS_ORIGINS') || '').split(',')[0]?.trim() || 'https://<your-domain>';
console.log('\nSaved to server/.env. Now restart the API:');
console.log('  systemctl restart water-system.service');
console.log('\nYour secret owner link (keep it private):');
console.log('  ' + origin.replace(/\/$/, '') + '/api/v1/owner/' + portalPath + '/');
