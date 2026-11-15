import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from './auth.controller';
import { asyncHandler } from '../../utils/async-handler';
import { validate } from '../../middlewares/validate.middleware';
import { authenticate } from '../../middlewares/auth.middleware';
import { loginSchema } from '@doctor-tracker/shared';
import { env } from '../../config/env';

const router = Router();

// Brute-force protection: 5 attempts per 15 min per IP (relaxed in test environment)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'test' ? 1000 : env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many authentication attempts. Please try again after 15 minutes.',
    },
  },
});

router.post('/login', authLimiter, validate(loginSchema), asyncHandler(authController.login.bind(authController)));
router.post('/refresh', asyncHandler(authController.refresh.bind(authController)));
router.post('/logout', asyncHandler(authController.logout.bind(authController)));
router.get('/me', authenticate, asyncHandler(authController.me.bind(authController)));

export const authRouter = router;
