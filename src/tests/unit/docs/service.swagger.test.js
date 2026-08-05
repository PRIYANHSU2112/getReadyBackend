import { describe, it, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { serviceDocs } from '../../../modules/service/service.docs.js';
import { setupSwagger } from '../../../core/swagger/swagger.setup.js';

describe('Service Swagger Documentation', () => {
  it('defines paths for all 19 service and change-request endpoints', () => {
    const paths = Object.keys(serviceDocs.paths);

    const expectedPaths = [
      '/api/v1/services/public',
      '/api/v1/services/public/category/{categoryId}',
      '/api/v1/services/public/{slug}',
      '/api/v1/services',
      '/api/v1/services/reorder',
      '/api/v1/services/bulk/status',
      '/api/v1/services/bulk/delete',
      '/api/v1/services/{id}',
      '/api/v1/services/{id}/restore',
      '/api/v1/services/{id}/status',
      '/api/v1/services/{id}/approve',
      '/api/v1/services/{id}/reject',
      '/api/v1/service-change-requests',
      '/api/v1/service-change-requests/{id}',
      '/api/v1/service-change-requests/{id}/approve',
      '/api/v1/service-change-requests/{id}/reject',
    ];

    for (const expectedPath of expectedPaths) {
      expect(paths).toContain(expectedPath);
    }
  });

  it('contains valid HTTP methods and response definitions for each path', () => {
    for (const [pathKey, methods] of Object.entries(serviceDocs.paths)) {
      for (const [methodKey, operation] of Object.entries(methods)) {
        expect(['get', 'post', 'patch', 'put', 'delete']).toContain(methodKey);
        expect(operation.tags).toBeDefined();
        expect(operation.summary).toBeDefined();
        expect(operation.responses).toBeDefined();
        expect(operation.responses['200'] || operation.responses['201'] || operation.responses['204']).toBeDefined();
      }
    }
  });

  it('mounts swagger ui and generates specification without throwing', async () => {
    const app = express();
    setupSwagger(app, [serviceDocs]);

    const res = await request(app).get('/api-docs/');
    expect([200, 301, 302]).toContain(res.status);
  });
});
