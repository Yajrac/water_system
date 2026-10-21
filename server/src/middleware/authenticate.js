import jwt from 'jsonwebtoken';

import { authConfig } from '../config/auth.js';
import { findUserById } from '../models/user.model.js';
import { AppError } from '../utils/app-error.js';

export function createAuthenticate(lookupUser = findUserById) {
  return async function authenticate(req, res, next) {
    res.set('Cache-Control', 'no-store');
    res.vary('Authorization');

    const authorization = req.get('Authorization') || '';
    const match = /^Bearer ([^\s]+)$/i.exec(authorization);
    if (!match) throw new AppError('A valid access token is required.', 401);

    let claims;
    try {
      claims = jwt.verify(match[1], authConfig.secret, {
        algorithms: ['HS256'],
        issuer: authConfig.issuer,
        audience: authConfig.audience,
      });
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError('Access token is invalid or expired. Please sign in again.', 401);
      }
      throw error;
    }

    if (
      typeof claims !== 'object' ||
      typeof claims.sub !== 'string' ||
      !/^[1-9]\d{0,19}$/.test(claims.sub || '') ||
      BigInt(claims.sub) > 18446744073709551615n ||
      !Number.isInteger(claims.exp)
    ) {
      throw new AppError('Access token is invalid or expired. Please sign in again.', 401);
    }

    // Use current database status and permissions, not a potentially stale token role.
    const user = await lookupUser(claims.sub);
    if (!user || Number(user.is_active) !== 1 || !['admin', 'consumer'].includes(user.role)) {
      throw new AppError('Access token is invalid or expired. Please sign in again.', 401);
    }

    req.user = {
      id: String(user.id),
      username: user.username,
      role: user.role,
    };

    next();
  };
}

export const authenticate = createAuthenticate();
