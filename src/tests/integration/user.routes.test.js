import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import { registerMongoHooks } from '../mongo.js';
import { createApp } from '../../app.js';
import { createShared } from '../../core/shared.js';
import { EventBus } from '../../core/events/EventBus.js';
import { JwtUtil } from '../../common/utils/jwt.util.js';

registerMongoHooks();

describe('User routes (integration)', () => {
  let app;

  beforeAll(() => {
    const shared = createShared({
      skipRedis: true,
      eventBus: new EventBus(),
      jwtUtil: new JwtUtil('test-jwt-secret-min-16-chars', '1h'),
      cacheService: null,
    });
    app = createApp({ shared });
  });

  it('POST /api/v1/users creates a user', async () => {
    const res = await request(app).post('/api/v1/users').send({
      name: 'Integration User',
      email: 'int@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('int@example.com');
    expect(res.body.data.password).toBeUndefined();
  });

  it('POST /api/v1/users/login returns token', async () => {
    await request(app).post('/api/v1/users').send({
      name: 'Login User',
      email: 'login@example.com',
      password: 'password123',
    });

    const res = await request(app).post('/api/v1/users/login').send({
      email: 'login@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
  });

  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });
});
