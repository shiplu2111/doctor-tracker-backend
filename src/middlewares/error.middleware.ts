import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/app-error';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const requestId = (req.headers['x-request-id'] as string) || 'unknown';

  // 1. AppError
  if (err instanceof AppError) {
    logger.warn({ err, requestId, path: req.path }, `Handled AppError [${err.code}]: ${err.message}`);
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // 2. Zod validation error
  const isZodError =
    err instanceof ZodError ||
    (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'ZodError') ||
    (typeof err === 'object' && err !== null && Array.isArray((err as { issues?: unknown }).issues));

  if (isZodError) {
    const zodErr = err as ZodError;
    const details = Array.isArray(zodErr.issues)
      ? zodErr.issues.map((issue) => ({
          path: Array.isArray(issue.path) ? issue.path.join('.') : String(issue.path ?? ''),
          message: issue.message,
        }))
      : [];
    logger.warn({ details, requestId, path: req.path }, 'Validation failed');
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details,
      },
    });
    return;
  }

  // 3. MongoDB duplicate key error (code 11000)
  interface MongoDuplicateError {
    code: number;
    keyPattern?: Record<string, unknown>;
    keyValue?: Record<string, unknown>;
  }
  const mongoErr = err as MongoDuplicateError;
  if (mongoErr && mongoErr.code === 11000) {
    logger.warn({ mongoErr, requestId }, 'Duplicate key conflict');
    res.status(409).json({
      error: {
        code: 'DUPLICATE_EMAIL',
        message: 'A record with this email already exists',
      },
    });
    return;
  }

  // 4. Mongoose CastError (e.g. invalid ObjectId)
  if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'CastError') {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid resource identifier format',
      },
    });
    return;
  }

  // 5. Unhandled / Internal Server Error
  logger.error({ err, requestId, path: req.path }, 'Unhandled server error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: env.NODE_ENV === 'production' ? 'An unexpected error occurred' : (err as Error)?.message || 'Internal server error',
    },
  });
};
