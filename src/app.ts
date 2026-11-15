import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import crypto from 'crypto';
import { env } from './config/env';
import { logger } from './utils/logger';
import { errorHandler } from './middlewares/error.middleware';
import { authRouter } from './modules/auth/auth.routes';
import { doctorRouter } from './modules/doctors/doctor.routes';
import { patientRouter } from './modules/patients/patient.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { searchRouter } from './modules/search/search.routes';
import { notificationRouter } from './modules/notifications/notification.routes';

export const createApp = (): Application => {
  const app: Application = express();

  // 1. Trust proxy in production if behind reverse proxy
  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // 2. Request ID & Request logging
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    res.setHeader('X-Request-Id', requestId);
    req.headers['x-request-id'] = requestId;

    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info(
        {
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: duration,
          requestId,
        },
        `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`,
      );
    });
    next();
  });

  // 3. Security headers (Helmet)
  app.use(helmet());

  // 4. CORS configuration
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id'],
    }),
  );

  // 5. Body parsers with size limit
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // 6. Cookie parser
  app.use(cookieParser());

  // 7. Data sanitization against NoSQL injection
  app.use(mongoSanitize());

  // 8. Global rate limiter
  const globalLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests, please try again later',
      },
    },
  });
  app.use('/api', globalLimiter);

  // 9. Health check endpoint (Public)
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // 10. Mount API v1 router
  const apiV1Router = express.Router();
  apiV1Router.use('/auth', authRouter);
  apiV1Router.use('/doctors', doctorRouter);
  apiV1Router.use('/patients', patientRouter);
  apiV1Router.use('/dashboard', dashboardRouter);
  apiV1Router.use('/search', searchRouter);
  apiV1Router.use('/notifications', notificationRouter);
  app.use('/api/v1', apiV1Router);

  // 11. 404 Route Not Found handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Requested resource or endpoint does not exist',
      },
    });
  });

  // 12. Central error handler
  app.use(errorHandler);

  return app;
};
