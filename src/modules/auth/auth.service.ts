import crypto from 'crypto';
import { userRepository } from '../users/user.repository';
import { refreshTokenRepository } from './refresh-token.repository';
import { verifyPassword } from '../../utils/password.util';
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
} from '../../utils/jwt.util';
import { AppError } from '../../utils/app-error';
import { LoginInput, ROLE_PERMISSIONS, AuthenticatedUser } from '@doctor-tracker/shared';
import { logger } from '../../utils/logger';

export class AuthService {
  async login(
    input: LoginInput,
    userAgent?: string,
    ip?: string,
  ): Promise<{
    user: AuthenticatedUser;
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await userRepository.findByEmailWithPassword(input.email);

    // Generic error to prevent user enumeration
    if (!user) {
      throw new AppError('INVALID_CREDENTIALS', 401, 'Invalid email or password');
    }

    // Check account lockout
    if (user.lockUntil && user.lockUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockUntil.getTime() - Date.now()) / (60 * 1000));
      logger.warn({ email: user.email, lockUntil: user.lockUntil }, 'Attempt to log in to locked account');
      throw new AppError(
        'ACCOUNT_LOCKED',
        423,
        `Account is temporarily locked due to too many failed attempts. Try again in ${remainingMinutes} minutes.`,
      );
    }

    if (!user.isActive) {
      throw new AppError('UNAUTHENTICATED', 401, 'User account is deactivated');
    }

    const isValidPassword = await verifyPassword(user.passwordHash, input.password);

    if (!isValidPassword) {
      const nextFailCount = (user.failedLoginCount || 0) + 1;
      let lockUntil: Date | null = null;

      if (nextFailCount >= 5) {
        lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes lockout
        logger.warn({ email: user.email }, 'Account locked after 5 failed login attempts');
      }

      await userRepository.recordFailedLogin(user._id, nextFailCount, lockUntil);
      throw new AppError('INVALID_CREDENTIALS', 401, 'Invalid email or password');
    }

    // Reset failed count and record login
    await userRepository.recordSuccessfulLogin(user._id);

    // Generate tokens
    const accessToken = signAccessToken(user._id.toString(), user.role);
    const { token: refreshToken, tokenHash } = generateRefreshToken();

    const familyId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await refreshTokenRepository.create({
      userId: user._id,
      tokenHash,
      familyId,
      expiresAt,
      userAgent,
      ip,
    });

    const permissions = [...(ROLE_PERMISSIONS[user.role] || [])];

    const safeUser: AuthenticatedUser = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      permissions,
    };

    return {
      user: safeUser,
      accessToken,
      refreshToken,
    };
  }

  async refresh(
    rawRefreshToken: string,
    userAgent?: string,
    ip?: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    if (!rawRefreshToken) {
      throw new AppError('UNAUTHENTICATED', 401, 'Refresh token required');
    }

    const tokenHash = hashToken(rawRefreshToken);
    const storedToken = await refreshTokenRepository.findByTokenHash(tokenHash);

    if (!storedToken) {
      throw new AppError('UNAUTHENTICATED', 401, 'Invalid or expired session');
    }

    // REUSE DETECTION: if revoked token is used, revoke the entire token family
    if (storedToken.revokedAt) {
      logger.error(
        { familyId: storedToken.familyId, userId: storedToken.userId },
        'Revoked refresh token reuse detected! Revoking token family.',
      );
      await refreshTokenRepository.revokeFamily(storedToken.familyId);
      throw new AppError('UNAUTHENTICATED', 401, 'Invalid session. Please login again.');
    }

    // Check expiration
    if (storedToken.expiresAt < new Date()) {
      throw new AppError('UNAUTHENTICATED', 401, 'Session expired. Please login again.');
    }

    // Check user active status
    const user = await userRepository.findById(storedToken.userId);
    if (!user || !user.isActive) {
      throw new AppError('UNAUTHENTICATED', 401, 'User account is deactivated or deleted');
    }

    // Invalidate current refresh token
    await refreshTokenRepository.revokeById(storedToken._id);

    // Issue rotated refresh token with SAME familyId
    const { token: newRefreshToken, tokenHash: newHash } = generateRefreshToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await refreshTokenRepository.create({
      userId: user._id,
      tokenHash: newHash,
      familyId: storedToken.familyId,
      expiresAt,
      userAgent,
      ip,
    });

    const accessToken = signAccessToken(user._id.toString(), user.role);

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(rawRefreshToken?: string): Promise<void> {
    if (!rawRefreshToken) return;

    try {
      const tokenHash = hashToken(rawRefreshToken);
      const storedToken = await refreshTokenRepository.findByTokenHash(tokenHash);
      if (storedToken && !storedToken.revokedAt) {
        await refreshTokenRepository.revokeById(storedToken._id);
      }
    } catch (err) {
      logger.warn({ err }, 'Error during logout token revocation');
    }
  }
}

export const authService = new AuthService();
