import { describe, it, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { packageDocs } from '../../../modules/package/package.docs.js';
import { setupSwagger } from '../../../core/swagger/swagger.setup.js';

describe('Package Swagger Documentation', () => {
  it('defines paths for all 13 package and package change-request endpoints', () => {
    const paths = Object.keys(packageDocs.paths);

    const expectedPaths = [
      '/api/v1/packages/public',
      '/api/v1/packages/public/category/{categoryId}',
      '/api/v1/packages/public/slug/{slug}',
      '/api/v1/packages/public/{id}',
      '/api/v1/packages',
      '/api/v1/packages/{id}',
      '/api/v1/packages/{id}/approve',
      '/api/v1/packages/{id}/reject',
      '/api/v1/packages/change-requests/list',
      '/api/v1/packages/change-requests/{id}/approve',
      '/api/v1/packages/change-requests/{id}/reject',
    ];

    for (const expectedPath of expectedPaths) {
      expect(paths).toContain(expectedPath);
    }
  });

  it('contains valid HTTP methods and response definitions for each path', () => {
    for (const [pathKey, methods] of Object.entries(packageDocs.paths)) {
      for (const [methodKey, operation] of Object.entries(methods)) {
        expect(['get', 'post', 'patch', 'put', 'delete']).toContain(methodKey);
        expect(operation.tags).toBeDefined();
        expect(operation.summary).toBeDefined();
        expect(operation.responses).toBeDefined();
        expect(operation.responses['200'] || operation.responses['201'] || operation.responses['204']).toBeDefined();
      }
    }
  });

  it('mounts swagger ui with package docs without throwing', async () => {
    const app = express();
    setupSwagger(app, [packageDocs]);

    const res = await request(app).get('/api-docs/');
    expect([200, 301, 302]).toContain(res.status);
  });
});
