import { Router } from 'express';

import { getCurrentUser, login } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { loginLimiter } from '../middleware/login-limiter.js';

const router = Router();

router.post('/login', loginLimiter, login);
router.get('/me', authenticate, getCurrentUser);

export default router;
