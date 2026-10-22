import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/require-role.js';
import * as service from '../services/consumer.service.js';
const router = Router();
router.use(authenticate, requireRole('consumer'));
router.get('/profile', async (req, res) =>
  res.json({ success: true, data: await service.ownProfile(req.user.id) }),
);
router.get('/finances', async (req, res) =>
  res.json({ success: true, data: await service.ownFinances(req.user.id, req.query) }),
);
router.get('/feedback', async (req, res) =>
  res.json({ success: true, data: await service.ownFeedback(req.user.id) }),
);
router.post(
  '/feedback',
  rateLimit({
    windowMs: 60000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => req.user.id,
    message: { success: false, message: 'Please wait before sending more feedback.' },
  }),
  async (req, res) =>
    res
      .status(201)
      .json({ success: true, data: await service.submitFeedback(req.user.id, req.body) }),
);
export default router;
