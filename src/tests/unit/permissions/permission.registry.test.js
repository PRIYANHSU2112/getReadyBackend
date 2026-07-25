import { describe, it, expect } from '@jest/globals';
import {
  matchRoute,
  normalizeApiPath,
  getPermissionKeys,
  listPermissions,
} from '../../../common/permissions/permission.registry.js';

describe('permission.registry', () => {
  it('lists catalog keys', () => {
    const keys = getPermissionKeys();
    expect(keys).toContain('users.read');
    expect(keys).toContain('roles.manage');
    expect(listPermissions().length).toBe(keys.length);
  });

  it('normalizes /api/v1 paths', () => {
    expect(normalizeApiPath('/api/v1/users')).toBe('/users');
    expect(normalizeApiPath('/api/v1/users/abc?x=1')).toBe('/users/abc');
    expect(normalizeApiPath('/users/')).toBe('/users');
  });

  it('matches list users to users.read', () => {
    const binding = matchRoute('GET', '/api/v1/users');
    expect(binding).toMatchObject({ permission: 'users.read', allowSelf: undefined });
  });

  it('matches get user by id with allowSelf', () => {
    const binding = matchRoute('GET', '/api/v1/users/507f1f77bcf86cd799439011');
    expect(binding).toMatchObject({
      permission: 'users.read',
      allowSelf: true,
      selfParam: 'id',
    });
  });

  it('prefers /roles/:id/permissions over /roles/:id', () => {
    const binding = matchRoute('PUT', '/api/v1/roles/507f1f77bcf86cd799439011/permissions');
    expect(binding.permission).toBe('roles.manage');
    expect(binding.pathPattern).toBe('/roles/:id/permissions');
  });

  it('matches /users/me as auth-only (no permission key)', () => {
    expect(matchRoute('GET', '/api/v1/users/me')).toMatchObject({
      pathPattern: '/users/me',
      permission: null,
    });
    expect(matchRoute('PATCH', '/api/v1/users/me')).toMatchObject({
      permission: null,
    });
  });

  it('matches banners catalog and public active route', () => {
    expect(getPermissionKeys()).toContain('banners.read');
    expect(matchRoute('GET', '/api/v1/banners/active')).toMatchObject({
      pathPattern: '/banners/active',
      permission: null,
    });
    expect(matchRoute('POST', '/api/v1/banners')).toMatchObject({
      permission: 'banners.create',
    });
  });

  it('matches filters catalog and public route', () => {
    expect(getPermissionKeys()).toContain('filters.read');
    expect(matchRoute('GET', '/api/v1/filters/public')).toMatchObject({
      pathPattern: '/filters/public',
      permission: null,
    });
    expect(matchRoute('PATCH', '/api/v1/filters/reorder')).toMatchObject({
      permission: 'filters.update',
    });
    expect(
      matchRoute('POST', '/api/v1/filters/507f1f77bcf86cd799439011/values'),
    ).toMatchObject({ permission: 'filters.create' });
  });
});
