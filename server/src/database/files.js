import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';

export const migrationsDirectory = new URL('../../database/migrations/', import.meta.url);
export const officeSeed = new URL('../../database/seeds/001_office_settings.sql', import.meta.url);
export const baselineThrough = '016_create_office_settings.sql';

export function checksum(sql) {
  // Git line-ending conversion does not change a migration's identity.
  return createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
}

export async function readMigrations(directory = migrationsDirectory) {
  const names = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
  const ids = new Set();
  if (!names.length) throw new Error('No migration files found.');
  return Promise.all(
    names.map(async (name) => {
      const match = /^(\d{3,})_[a-z0-9_]+\.sql$/.exec(name);
      if (!match || ids.has(match[1]))
        throw new Error('Invalid or duplicate migration number: ' + name);
      ids.add(match[1]);
      const sql = await readFile(new URL(name, directory), 'utf8');
      if (!sql.trim()) throw new Error('Empty migration: ' + name);
      return { name, sql, checksum: checksum(sql) };
    }),
  );
}

export function validateHistory(files, history) {
  for (const [index, record] of history.entries()) {
    const file = files[index];
    if (!file || file.name !== record.name) {
      throw new Error('Migration history is not an ordered prefix of local files: ' + record.name);
    }
    if (record.checksum !== file.checksum) {
      throw new Error(
        'Applied migration changed: ' + record.name + '. Restore it; add a new migration instead.',
      );
    }
    if (!['applied', 'baseline'].includes(record.status)) {
      throw new Error(
        'Incomplete migration: ' + record.name + '. Inspect its partial DDL before retrying.',
      );
    }
  }
  return files.slice(history.length);
}
