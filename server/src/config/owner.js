import path from 'node:path';

// Owner portal: a hidden page for permanent deletes that admins cannot do.
// It stays switched off (every path 404s) until both values are set in .env.
// Create them with: node --env-file=.env scripts/set-owner.js
export function readOwnerConfig(env = process.env) {
  const portalPath = env.OWNER_PORTAL_PATH?.trim();
  const passwordHash = env.OWNER_PASSWORD_HASH?.trim();
  if (!portalPath && !passwordHash) return null;
  if (!/^[A-Za-z0-9_-]{24,80}$/.test(portalPath || '')) {
    throw new Error('OWNER_PORTAL_PATH must be 24-80 letters, digits, "-" or "_".');
  }
  if (!passwordHash?.startsWith('$argon2id$')) {
    throw new Error('OWNER_PASSWORD_HASH must be an Argon2id hash from scripts/set-owner.js.');
  }
  return {
    portalPath,
    passwordHash,
    backupDir: path.resolve(env.OWNER_BACKUP_DIR?.trim() || 'deleted-backups'),
  };
}
