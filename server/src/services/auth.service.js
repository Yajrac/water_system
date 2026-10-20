import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';

import { authConfig } from '../config/auth.js';
import {
  findUserByUsername,
  updateLastLogin,
} from '../models/user.model.js';
import {
  hashPassword,
  verifyPassword,
} from '../utils/password.js';
import { AppError } from '../utils/app-error.js';

// Performs password verification even when the username does not exist.
const dummyHash = await hashPassword(
  randomBytes(32).toString('hex'),
);

export async function loginUser(username, password) {
  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    !username.trim() ||
    username.trim().length > 40 ||
    !password ||
    password.length > 1024
  ) {
    throw new AppError('Enter a valid username and password.', 400);
  }

  const user = await findUserByUsername(username.trim());

  const passwordMatches = await verifyPassword(
    user?.password_hash || dummyHash,
    password,
  );

  if (
    !user ||
    !passwordMatches ||
    Number(user.is_active) !== 1 ||
    !['admin', 'consumer'].includes(user.role)
  ) {
    throw new AppError('Invalid username or password.', 401);
  }

  const accessToken = jwt.sign(
    { role: user.role },
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
    tokenType: 'Bearer',
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  };
}