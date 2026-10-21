import { Router } from 'express';

import { getCurrentUser, login, changePassword, refreshSession, logoutSession } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { loginLimiter } from '../middleware/login-limiter.js';

const router = Router();

router.post('/login', loginLimiter, login);
router.post('/refresh', refreshSession);
router.post('/logout', logoutSession);
router.get('/me', authenticate, getCurrentUser);
router.post('/change-password', loginLimiter, authenticate, changePassword);

export default router;
