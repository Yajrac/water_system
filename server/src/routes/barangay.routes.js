import { Router } from 'express';

import {
  listBarangays,
  registerBarangay,
  unregisterBarangay,
} from '../controllers/barangay.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/require-role.js';

const router = Router();

router.use(authenticate, requireRole('admin'));

router.get('/', listBarangays);
router.post('/', registerBarangay);
router.delete('/:id', unregisterBarangay);

export default router;
