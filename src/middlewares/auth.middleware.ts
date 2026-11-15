import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.util';
import { userRepository } from '../modules/users/user.repository';
import { AppError } from '../utils/app-error';
import { ROLE_PERMISSIONS } from '@doctor-tracker/shared';

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token =
      req.cookies?.dt_access ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1]
        : null);

    if (!token) {
      throw new AppError('UNAUTHENTICATED', 401, 'Authentication required');
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'TokenExpiredError') {
        throw new AppError('TOKEN_EXPIRED', 401, 'Access token has expired');
      }
      throw new AppError('UNAUTHENTICATED', 401, 'Invalid authentication token');
    }

    const user = await userRepository.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new AppError('UNAUTHENTICATED', 401, 'User account is deactivated or not found');
    }

    const permissions = [...(ROLE_PERMISSIONS[user.role] || [])];

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      permissions,
    };

    next();
  } catch (error) {
    next(error);
  }
};
