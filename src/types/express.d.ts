import { AuthenticatedUser } from '@doctor-tracker/shared';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
