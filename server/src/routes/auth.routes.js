import { Router } from 'express';

import { getCurrentUser, login, changePassword, refreshSession, logoutSession, forgotPassword } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { loginLimiter, forgotPasswordLimiter } from '../middleware/login-limiter.js';

const router = Router();

router.post('/login', loginLimiter, login);
router.post('/refresh', refreshSession);
router.post('/logout', logoutSession);
router.get('/me', authenticate, getCurrentUser);
router.post('/change-password', loginLimiter, authenticate, changePassword);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);

export default router;
