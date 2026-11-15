import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error';
import { Permission } from '@doctor-tracker/shared';

export const authorize = (permission: Permission) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('UNAUTHENTICATED', 401, 'Authentication required'));
    }

    const { permissions } = req.user;

    // Super admin has '*' which grants all permissions
    if (permissions.includes('*') || permissions.includes(permission)) {
      return next();
    }

    return next(
      new AppError(
        'FORBIDDEN',
        403,
        `You do not have permission to perform this action (${permission})`,
      ),
    );
  };
};
