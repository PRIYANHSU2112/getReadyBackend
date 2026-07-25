import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { createCheckPermission } from '../../../common/middleware/authorize.middleware.js';
import { ForbiddenError } from '../../../common/errors/ForbiddenError.js';
import { UnauthorizedError } from '../../../common/errors/UnauthorizedError.js';

describe('createCheckPermission', () => {
  let roleService;
  let checkPermission;

  beforeEach(() => {
    roleService = {
      getAuthorizationForSlug: jest.fn(),
    };
    checkPermission = createCheckPermission({ roleService });
  });

  function run(req) {
    return new Promise((resolve, reject) => {
      checkPermission(req, {}, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  it('rejects unauthenticated requests', async () => {
    await expect(run({ method: 'GET', originalUrl: '/api/v1/users', user: null })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('allows routes with no registry binding', async () => {
    await expect(
      run({ method: 'GET', originalUrl: '/api/v1/users/me', user: { id: 'u1', role: 'customer' } }),
    ).resolves.toBeUndefined();
    expect(roleService.getAuthorizationForSlug).not.toHaveBeenCalled();
  });

  it('allows self access when allowSelf matches', async () => {
    await expect(
      run({
        method: 'GET',
        originalUrl: '/api/v1/users/u1',
        params: { id: 'u1' },
        user: { id: 'u1', role: 'customer' },
      }),
    ).resolves.toBeUndefined();
    expect(roleService.getAuthorizationForSlug).not.toHaveBeenCalled();
  });

  it('allows super admin without explicit permission', async () => {
    roleService.getAuthorizationForSlug.mockResolvedValue({
      slug: 'super_admin',
      isSuperAdmin: true,
      permissions: [],
      isActive: true,
    });

    await expect(
      run({
        method: 'GET',
        originalUrl: '/api/v1/users',
        user: { id: 'sa1', role: 'super_admin' },
      }),
    ).resolves.toBeUndefined();
  });

  it('forbids when permission is missing', async () => {
    roleService.getAuthorizationForSlug.mockResolvedValue({
      slug: 'customer',
      isSuperAdmin: false,
      permissions: [],
      isActive: true,
    });

    await expect(
      run({
        method: 'GET',
        originalUrl: '/api/v1/users',
        user: { id: 'c1', role: 'customer' },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('allows when role has required permission', async () => {
    roleService.getAuthorizationForSlug.mockResolvedValue({
      slug: 'admin',
      isSuperAdmin: false,
      permissions: ['users.read'],
      isActive: true,
    });

    await expect(
      run({
        method: 'GET',
        originalUrl: '/api/v1/users',
        user: { id: 'a1', role: 'admin' },
      }),
    ).resolves.toBeUndefined();
  });
});
