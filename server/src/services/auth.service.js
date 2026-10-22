import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';

import { authConfig } from '../config/auth.js';
import { findUserByLogin, findUserById, updateLastLogin } from '../models/user.model.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { AppError } from '../utils/app-error.js';

// Performs password verification even when the username does not exist.
const dummyHash = await hashPassword(randomBytes(32).toString('hex'));

export async function loginUser(username, password) {
  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    !username.trim() ||
    username.trim().length > 60 ||
    !password ||
    password.length > 1024
  ) {
    throw new AppError('Enter a valid username and password.', 400);
  }

  const user = await findUserByLogin(username.trim());

  const passwordMatches = await verifyPassword(user?.password_hash || dummyHash, password);

  if (
    !user ||
    !passwordMatches ||
    Number(user.is_active) !== 1 ||
    !['admin', 'consumer'].includes(user.role)
  ) {
    throw new AppError('Invalid username or password.', 401);
  }

  const accessToken = jwt.sign(
    { role: user.role, version: Number(user.auth_version || 0) },
    authConfig.secret,
    {
      algorithm: 'HS256',
      subject: String(user.id),
      expiresIn: authConfig.expiresIn,
      issuer: authConfig.issuer,
      audience: authConfig.audience,
    },
  );

  await updateLastLogin(user.id);

  return {
    accessToken,
    refreshToken: signSession(user),
    tokenType: 'Bearer',
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      mustChangePassword: Number(user.must_change_password) === 1,
    },
  };
}

function signSession(user) {
  return jwt.sign({ purpose: user.role + '-session', version: Number(user.auth_version || 0) }, authConfig.secret, {
    algorithm: 'HS256', subject: String(user.id), expiresIn: '30d',
    issuer: authConfig.issuer, audience: authConfig.audience,
  });
}

export async function renewAdminSession(token) {
  let claims;
  try {
    claims = jwt.verify(token, authConfig.secret, {
      algorithms: ['HS256'], issuer: authConfig.issuer, audience: authConfig.audience,
    });
  } catch {
    throw new AppError('Session expired. Please sign in again.', 401);
  }
  if (!['admin-session', 'consumer-session'].includes(claims.purpose) || !/^[1-9]\d{0,19}$/.test(claims.sub || ''))
    throw new AppError('Invalid session.', 401);
  const user = await findUserById(claims.sub);
  if (!user || !['admin', 'consumer'].includes(user.role) || claims.purpose !== user.role + '-session' || Number(user.is_active) !== 1 ||
      claims.version !== Number(user.auth_version || 0))
    throw new AppError('Session ended. Please sign in again.', 401);
  return {
    accessToken: jwt.sign({ role: user.role, version: Number(user.auth_version || 0) }, authConfig.secret, {
      algorithm: 'HS256', subject: String(user.id), expiresIn: authConfig.expiresIn,
      issuer: authConfig.issuer, audience: authConfig.audience,
    }),
    refreshToken: signSession(user),
    user: { id: String(user.id), username: user.username, role: user.role, mustChangePassword: Number(user.must_change_password) === 1 },
  };
}
