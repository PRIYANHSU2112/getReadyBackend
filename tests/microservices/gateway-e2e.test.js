import { jest } from '@jest/globals';
import express from 'express';
import supertest from 'supertest';
import { createApp as createGatewayApp } from '../../services/api-gateway/src/app.js';
import { createApp as createAuthApp } from '../../services/auth-service/src/app.js';
import { createApp as createCatalogApp } from '../../services/catalog-service/src/app.js';

describe('Gateway & Microservice E2E Integration Suite', () => {
  let authApp;
  let catalogApp;
  let gatewayApp;
  let authServer;
  let catalogServer;

  beforeAll(async () => {
    // 1. Mock dependencies for Auth Service
    const mockAuthService = {
      mobileSendOtp: jest.fn().mockResolvedValue({ message: 'OTP sent successfully' }),
      mobileVerifyOtp: jest.fn().mockResolvedValue({ token: 'mock-jwt-token' }),
    };
    authApp = createAuthApp({ authService: mockAuthService });
    await new Promise((resolve) => {
      authServer = authApp.listen(3091, resolve);
    });

    // 2. Mock dependencies for Catalog Service
    const mockCategoryService = {
      listPublic: jest.fn().mockResolvedValue([{ id: 'cat-1', name: 'Hair Care', slug: 'hair-care' }]),
    };
    catalogApp = createCatalogApp({ categoryService: mockCategoryService });
    await new Promise((resolve) => {
      catalogServer = catalogApp.listen(3094, resolve);
    });

    // 3. Create Gateway with test service ports
    gatewayApp = createGatewayApp({
      services: {
        auth: 'http://127.0.0.1:3091',
        catalog: 'http://127.0.0.1:3094',
      },
    });
  });

  afterAll((done) => {
    if (authServer) {
      authServer.close(() => {
        if (catalogServer) {
          catalogServer.close(done);
        } else {
          done();
        }
      });
    } else {
      done();
    }
  });

  it('Gateway /health should return healthy status', async () => {
    const res = await supertest(gatewayApp).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('healthy');
    expect(res.body.data.service).toBe('api-gateway');
  });

  it('Gateway /ready should return ready status', async () => {
    const res = await supertest(gatewayApp).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ready');
  });

  it('Gateway should proxy /api/v1/auth/mobile/send-otp to Auth Service', async () => {
    const res = await supertest(gatewayApp)
      .post('/api/v1/auth/mobile/send-otp')
      .send({ phone: '9876543210', role: 'customer' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe('OTP sent successfully');
  });

  it('Gateway should proxy /api/v1/categories/public to Catalog Service', async () => {
    const res = await supertest(gatewayApp).get('/api/v1/categories/public');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].slug).toBe('hair-care');
  });

  it('Gateway should attach correlation ID in response headers', async () => {
    const customCorrelationId = 'test-corr-id-12345';
    const res = await supertest(gatewayApp)
      .get('/health')
      .set('x-correlation-id', customCorrelationId);

    expect(res.headers['x-correlation-id']).toBe(customCorrelationId);
  });
});
