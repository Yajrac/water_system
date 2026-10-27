import { Router } from 'express';
import * as controller from '../controllers/customer.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/require-role.js';

const router = Router();
router.use(authenticate, requireRole('admin'));
router.get('/', controller.list);
router.post('/', controller.create);
router.post('/check-duplicate', controller.duplicate);
router.post('/import', controller.importRecords);
router.post('/import/preview', controller.previewImport);
router.post('/delete-selected', controller.removeSelected);
router.get('/connections', controller.connections);
router.get('/:id', controller.profile);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.patch('/:id/status', controller.status);
export default router;
