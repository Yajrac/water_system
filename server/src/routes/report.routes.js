import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/require-role.js';
import { readReport } from '../services/report.service.js';

const router = Router();
router.use(authenticate, requireRole('admin'));
router.get('/', async (req, res) => {
  res.json({ success: true, data: await readReport(req.query) });
});
export default router;
