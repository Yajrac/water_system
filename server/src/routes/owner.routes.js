import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

import { loginLimiter } from '../middleware/login-limiter.js';
import { AppError } from '../utils/app-error.js';

const portalDir = fileURLToPath(new URL('../../owner-portal/', import.meta.url));
const pages = { 'owner.js': 'owner.js', 'owner.css': 'owner.css' };

// Mounted at /api/v1/owner/<OWNER_PORTAL_PATH>: the page, its two assets and a small JSON API.
export function createOwnerRouter({ service }) {
  const router = express.Router();

  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    res.set('Referrer-Policy', 'no-referrer');
    next();
  });

  router.get('/', (req, res) => {
    // Relative asset and API paths need the trailing slash.
    const url = req.originalUrl.split('?')[0];
    if (!url.endsWith('/')) return res.redirect(301, url + '/');
    res.sendFile(path.join(portalDir, 'index.html'));
  });
  for (const [route, file] of Object.entries(pages)) {
    router.get('/' + route, (req, res) => res.sendFile(path.join(portalDir, file)));
  }

  router.post('/api/login', loginLimiter, async (req, res) => {
    res.json({ success: true, data: await service.login(req.body?.password) });
  });

  router.use('/api', (req, res, next) => {
    const match = /^Bearer ([^\s]+)$/i.exec(req.get('Authorization') || '');
    if (!match) throw new AppError('Sign in to continue.', 401);
    service.verifyToken(match[1]);
    next();
  });

  router.get('/api/customers', async (req, res) => {
    res.json({ success: true, data: await service.searchCustomers(req.query.q, req.query.page) });
  });
  router.get('/api/history', async (req, res) => {
    res.json({ success: true, data: await service.listDeletions() });
  });
  router.get('/api/customers/:id', async (req, res) => {
    res.json({ success: true, data: await service.previewCustomer(req.params.id) });
  });
  router.delete('/api/customers/:id', async (req, res) => {
    res.json({ success: true, data: await service.deleteCustomer(req.params.id, req.body?.confirm) });
  });

  return router;
}
