import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/require-role.js';
import * as service from '../services/consumer.service.js';
const router=Router();
router.use(authenticate,requireRole('admin'));
router.get('/',async(req,res)=>res.json({success:true,data:await service.adminFeedback(req.query)}));
router.patch('/:id',async(req,res)=>res.json({success:true,data:await service.updateFeedback(req.params.id,req.body,req.user.id)}));
export default router;
