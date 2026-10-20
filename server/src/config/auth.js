const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret || jwtSecret.length < 64) {
  throw new Error('JWT_SECRET must contain at least 64 characters.');
}

export const authConfig = {
  secret: jwtSecret,
  expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  issuer: 'water-system-api',
  audience: 'water-system-apps',
};