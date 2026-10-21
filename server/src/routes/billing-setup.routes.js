import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/require-role.js';
import { listBillingSetups, saveBillingSetup } from '../controllers/billing-setup.controller.js';

const router = Router();
router.use(authenticate, requireRole('admin'));
router.get('/', listBillingSetups);
router.put('/', saveBillingSetup);
export default router;
