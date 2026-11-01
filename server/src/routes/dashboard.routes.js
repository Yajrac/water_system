import { Router } from 'express';
import { syncLateFees } from '../middleware/sync-late-fees.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/require-role.js';
import { dashboard } from '../controllers/dashboard.controller.js';
const router = Router();
router.use(authenticate, requireRole('admin'), syncLateFees);
router.get('/', dashboard);
export default router;
