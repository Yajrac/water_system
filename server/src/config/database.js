import { readFile } from 'node:fs/promises';

export async function databaseOptions(env = process.env) {
  for (const key of ['DB_HOST', 'DB_NAME', 'DB_USER']) {
    if (!env[key]?.trim()) throw new Error('Missing environment variable: ' + key);
  }
  const port = Number(env.DB_PORT || 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT must be an integer between 1 and 65535.');
  }
  return {
    host: env.DB_HOST,
    port,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD || '',
    charset: 'utf8mb4_unicode_ci',
    timezone: 'Z',
    supportBigNumbers: true,
    bigNumberStrings: true,
    connectTimeout: 10000,
    ...(env.DB_SSL_CA ? { ssl: { ca: await readFile(env.DB_SSL_CA) } } : {}),
  };
}
