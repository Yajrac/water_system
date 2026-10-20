import { Router } from 'express';

import { login } from '../controllers/auth.controller.js';
import { loginLimiter } from '../middleware/login-limiter.js';

const router = Router();

router.post('/login', loginLimiter, login);

export default router;