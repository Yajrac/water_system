import { Router } from 'express';

import { listBarangays } from '../controllers/barangay.controller.js';

const router = Router();

router.get('/', listBarangays);

export default router;
