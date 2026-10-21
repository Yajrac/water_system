import { pool } from '../database/pool.js';
import { loginUser, renewAdminSession } from '../services/auth.service.js';
import { changeOwnPassword } from '../services/change-password.service.js';

export async function changePassword(req, res) {
  await changeOwnPassword(req.user.id, req.body);
  res.json({ success: true, data: { mustChangePassword: false, signInRequired: true } });
}

export function getCurrentUser(req, res) {
  res.status(200).json({
    success: true,
    data: { user: req.user },
  });
}

export async function login(req, res) {
  const { username, password } = req.body || {};

  const result = await loginUser(username, password);

  res.set('Cache-Control', 'no-store');

  res.status(200).json({
    success: true,
    data: result,
  });
}

export async function refreshSession(req, res) {
  const result = await renewAdminSession(req.body?.refreshToken);
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: result });
}

export async function logoutSession(req, res) {
  const result = await renewAdminSession(req.body?.refreshToken);
  await pool.execute('UPDATE users SET auth_version = auth_version + 1 WHERE id = ?', [result.user.id]);
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: { signedOut: true } });
}
