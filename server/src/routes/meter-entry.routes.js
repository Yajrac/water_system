import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/require-role.js';
import { listMeterEntries, saveMeterEntry } from '../controllers/meter-entry.controller.js';

const router = Router();
router.use(authenticate, requireRole('admin'));
router.get('/', listMeterEntries);
router.put('/', saveMeterEntry);
export default router;
