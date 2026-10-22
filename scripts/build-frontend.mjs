import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist-frontend');
if (dirname(output) !== root || output === root) throw new Error('Invalid publish directory.');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
// Explicit public files only
// backend, SQL exports and environment files stay out.
for (const name of ['index.html', 'html', 'css', 'js', 'assets']) {
  await cp(resolve(root, name), resolve(output, name), { recursive: true });
}
await cp(resolve(root, 'html/404.html'), resolve(output, '404.html'));
await mkdir(resolve(output, 'data'), { recursive: true });
for (const name of ['pio-duran-barangays.json', 'sample-customers.json', 'sample-service-records.json']) {
  await cp(resolve(root, 'data', name), resolve(output, 'data', name));
}
console.log('Frontend ready: dist-frontend (login: /html/login.html)');
