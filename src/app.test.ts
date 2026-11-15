import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app';

describe('App Core Integration', () => {
  const app = createApp();

  it('GET /health should return 200 with status ok and uptime', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptime');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('GET /unknown-endpoint should return 404 in standard error envelope', async () => {
    const res = await request(app).get('/unknown-endpoint');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Requested resource or endpoint does not exist',
      },
    });
    expect(res.headers['x-request-id']).toBeDefined();
  });
});
