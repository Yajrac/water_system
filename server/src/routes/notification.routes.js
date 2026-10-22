import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/require-role.js';
import * as service from '../services/notification.service.js';
const router = Router();
router.use(authenticate);
router.get('/mine', requireRole('consumer'), async (req, res) => {
  res.json({ success: true, data: await service.consumerNotifications(req.user.id) });
});
router.post('/read', requireRole('consumer'), async (req, res) =>
  res.json({ success: true, data: await service.markNotificationsRead(req.user.id, req.body) }),
);
router.use(requireRole('admin'));
router.get('/recipients', async (req, res) =>
  res.json({ success: true, data: await service.recipientOptions() }),
);
router.get('/', async (req, res) => res.json({ success: true, data: await service.listNotices() }));
router.post('/', async (req, res) =>
  res.status(201).json({ success: true, data: await service.saveNotice(req.body, req.user.id) }),
);
export default router;
