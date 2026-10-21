import { loginUser } from '../services/auth.service.js';

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
