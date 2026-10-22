import { confirm, input, password } from '@inquirer/prompts';

import { pool } from '../src/database/pool.js';
import {
  createAdminUser,
  findUserByUsername,
} from '../src/models/user.model.js';
import { hashPassword } from '../src/utils/password.js';

async function createAdmin() {
  const username = await input({
    message: 'Admin username:',
    validate(value) {
      return /^[A-Za-z0-9._-]{3,40}$/.test(value.trim())
        || 'Use 3–40 letters, numbers, periods, underscores or hyphens.';
    },
  });

  const name = username.trim();

  if (await findUserByUsername(name)) {
    throw new Error('That username is already taken.');
  }

  const showPassword = await confirm({
    message: 'Show password while typing?',
    default: false,
  });

  const askPassword = showPassword ? input : password;

  const newPassword = await askPassword({
    message: 'Temporary password:',
    validate(value) {
      return (value.length >= 8 && value.length <= 128)
        || 'Use a password with 12–128 characters.';
    },
  });

  await askPassword({
    message: 'Confirm password:',
    validate(value) {
      return value === newPassword || 'Passwords do not match.';
    },
  });

  const accepted = await confirm({
    message: `Create admin account "${name}"?`,
    default: false,
  });

  if (!accepted) {
    console.log('Cancelled. No account was created.');
    return;
  }

  const passwordHash = await hashPassword(newPassword);

  await createAdminUser(name, passwordHash);

  console.log('Admin account created. The temporary password must be changed at first sign-in.');
}

try {
  await createAdmin();
} catch (error) {
  if (error.name === 'ExitPromptError') {
    console.log('\nCancelled.');
  } else if (error.code === 'ER_DUP_ENTRY') {
    console.error('That username is already taken.');
    process.exitCode = 1;
  } else {
    console.error('Could not create admin:', error.message);
    process.exitCode = 1;
  }
} finally {
  await pool.end();
}