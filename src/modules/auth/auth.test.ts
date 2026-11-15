import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../app';
import { UserModel } from '../users/user.schema';
import { hashPassword } from '../../utils/password.util';
import { ROLES } from '@doctor-tracker/shared';

describe('Authentication & Session Management', () => {
  let mongoServer: MongoMemoryServer;
  const app = createApp();

  const testUser = {
    name: 'Test Doctor Admin',
    email: 'admin.test@example.com',
    password: 'StrongPassword123!',
  };

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Create test user
    const passwordHash = await hashPassword(testUser.password);
    await UserModel.create({
      name: testUser.name,
      email: testUser.email,
      passwordHash,
      role: ROLES.ADMIN,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('GET /api/v1/auth/me should return 401 when no token is provided', async () => {
    const res = await request(app).get('/api/v1/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('POST /api/v1/auth/login should reject invalid credentials with generic 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: 'WrongPassword999!' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('POST /api/v1/auth/login should authenticate valid credentials and set cookies', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(testUser.email);
    expect(res.body.data.user.role).toBe(ROLES.ADMIN);
    expect(res.body.data.user.permissions).toContain('doctor:read');
    expect(res.body.data.user).not.toHaveProperty('passwordHash');

    // Verify Set-Cookie headers
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();
    expect(cookies.some((c) => c.includes('dt_access='))).toBe(true);
    expect(cookies.some((c) => c.includes('dt_refresh='))).toBe(true);
  });

  it('POST /api/v1/auth/refresh should rotate refresh token successfully', async () => {
    // 1. Login to get initial cookies
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    const refreshCookie = cookies.find((c) => c.startsWith('dt_refresh='));

    // 2. Call refresh
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie!);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.ok).toBe(true);

    const newCookies = refreshRes.headers['set-cookie'] as unknown as string[];
    expect(newCookies.some((c) => c.includes('dt_access='))).toBe(true);
    expect(newCookies.some((c) => c.includes('dt_refresh='))).toBe(true);

    // 3. Replay attack: reusing the old refresh cookie should fail and revoke family
    const replayRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie!);

    expect(replayRes.status).toBe(401);
    expect(replayRes.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('POST /api/v1/auth/logout should clear cookies and revoke token', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    const refreshCookie = cookies.find((c) => c.startsWith('dt_refresh='));

    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', refreshCookie!);

    expect(logoutRes.status).toBe(204);

    const clearedCookies = logoutRes.headers['set-cookie'] as unknown as string[];
    expect(clearedCookies.some((c) => c.includes('dt_access=;'))).toBe(true);
    expect(clearedCookies.some((c) => c.includes('dt_refresh=;'))).toBe(true);
  });

  it('Account should lock after 5 consecutive failed attempts (423 ACCOUNT_LOCKED)', async () => {
    const targetEmail = 'lockout.test@example.com';
    const pwdHash = await hashPassword('ValidPass123!');
    await UserModel.create({
      name: 'Lockout Target',
      email: targetEmail,
      passwordHash: pwdHash,
      role: ROLES.VIEWER,
    });

    // 4 failed attempts
    for (let i = 0; i < 4; i++) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: targetEmail, password: 'BadPassword' });
      expect(res.status).toBe(401);
    }

    // 5th failed attempt locks the account
    const fifthRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: targetEmail, password: 'BadPassword' });
    expect(fifthRes.status).toBe(401);

    // 6th attempt with ANY password returns 423 ACCOUNT_LOCKED
    const lockedRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: targetEmail, password: 'ValidPass123!' });

    expect(lockedRes.status).toBe(423);
    expect(lockedRes.body.error.code).toBe('ACCOUNT_LOCKED');
  });
});
