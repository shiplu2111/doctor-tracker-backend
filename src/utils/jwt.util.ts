import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import { Role } from '@doctor-tracker/shared';

export interface TokenPayload {
  sub: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export const signAccessToken = (userId: string, role: Role): string => {
  return jwt.sign({ sub: userId, role }, env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
};

export const generateRefreshToken = (): { token: string; tokenHash: string } => {
  const token = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(token);
  return { token, tokenHash };
};

export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};
