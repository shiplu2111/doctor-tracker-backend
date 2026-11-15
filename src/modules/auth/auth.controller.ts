import { Request, Response } from 'express';
import { authService } from './auth.service';
import { env } from '../../config/env';
import { CookieOptions } from 'express';

const getAccessCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: env.COOKIE_SAMESITE,
  domain: env.COOKIE_DOMAIN === 'localhost' || !env.COOKIE_DOMAIN ? undefined : env.COOKIE_DOMAIN,
  path: '/',
  maxAge: 15 * 60 * 1000, // 15 minutes
});

const getRefreshCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: env.COOKIE_SAMESITE,
  domain: env.COOKIE_DOMAIN === 'localhost' || !env.COOKIE_DOMAIN ? undefined : env.COOKIE_DOMAIN,
  path: '/api/v1/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});

export class AuthController {
  async login(req: Request, res: Response): Promise<void> {
    const userAgent = req.headers['user-agent'];
    const ip = req.ip;

    const result = await authService.login(req.body, userAgent, ip);

    res.cookie('dt_access', result.accessToken, getAccessCookieOptions());
    res.cookie('dt_refresh', result.refreshToken, getRefreshCookieOptions());

    res.status(200).json({
      data: {
        user: result.user,
      },
    });
  }

  async refresh(req: Request, res: Response): Promise<void> {
    const rawRefreshToken = req.cookies?.dt_refresh;
    const userAgent = req.headers['user-agent'];
    const ip = req.ip;

    const result = await authService.refresh(rawRefreshToken, userAgent, ip);

    res.cookie('dt_access', result.accessToken, getAccessCookieOptions());
    res.cookie('dt_refresh', result.refreshToken, getRefreshCookieOptions());

    res.status(200).json({
      data: {
        ok: true,
      },
    });
  }

  async logout(req: Request, res: Response): Promise<void> {
    const rawRefreshToken = req.cookies?.dt_refresh;
    await authService.logout(rawRefreshToken);

    const clearDomain = env.COOKIE_DOMAIN === 'localhost' || !env.COOKIE_DOMAIN ? undefined : env.COOKIE_DOMAIN;

    res.cookie('dt_access', '', {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: env.COOKIE_SAMESITE,
      domain: clearDomain,
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    });

    res.cookie('dt_refresh', '', {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: env.COOKIE_SAMESITE,
      domain: clearDomain,
      path: '/api/v1/auth',
      maxAge: 0,
      expires: new Date(0),
    });

    res.status(204).send();
  }

  async me(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      data: req.user,
    });
  }
}

export const authController = new AuthController();
