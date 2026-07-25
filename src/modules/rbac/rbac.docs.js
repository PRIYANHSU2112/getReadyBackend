import {
  bearerSecurity,
  roleExample,
  permissionExample,
  PERMISSION_KEY_ENUM,
  paginationMeta,
  jsonBody,
  okResponse,
  createdResponse,
  noContentResponse,
  withErrors,
  successExample,
  objectIdParam,
  pageQueryParams,
} from '../../core/swagger/swagger.common.js';

const accessRead =
  '**Auth:** Bearer JWT.\n\n**Access:** Admin (`roles.read`). Super Admin bypasses. Not for Beautician by default.';

const accessManage =
  '**Auth:** Bearer JWT.\n\n**Access:** Admin (`roles.manage`). Super Admin bypasses.';

const accessPermRead =
  '**Auth:** Bearer JWT.\n\n**Access:** Admin (`permissions.read`). Super Admin bypasses.';

const accessPermSync =
  '**Auth:** Bearer JWT.\n\n**Access:** Admin (`permissions.sync`). Super Admin bypasses.';

export const rbacDocs = {
  paths: {
    '/api/v1/roles': {
      get: {
        tags: ['RBAC'],
        summary: '[Admin] List roles',
        description: accessRead,
        security: bearerSecurity,
        parameters: [
          ...pageQueryParams({ page: 1, limit: 10 }),
          {
            name: 'sort',
            in: 'query',
            schema: {
              type: 'string',
              default: 'name',
              enum: ['name', '-name', 'slug', '-slug', 'createdAt', '-createdAt'],
              example: 'name',
            },
          },
          { name: 'search', in: 'query', schema: { type: 'string', example: 'admin' } },
          { name: 'isActive', in: 'query', schema: { type: 'boolean', example: true } },
          { name: 'isSystem', in: 'query', schema: { type: 'boolean', example: true } },
        ],
        responses: {
          ...okResponse(
            successExample([roleExample], {
              ...paginationMeta,
              total: 4,
              sort: 'name',
              filters: { search: 'admin' },
            }),
          ),
          ...withErrors(401, 403, 422, 500),
        },
      },
      post: {
        tags: ['RBAC'],
        summary: '[Admin] Create custom role',
        description: `${accessManage}\n\nCannot create a Super Admin role. Permission keys must already exist (run permissions sync first).`,
        security: bearerSecurity,
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['name', 'slug'],
            additionalProperties: false,
            properties: {
              name: { type: 'string', minLength: 2, maxLength: 100, example: 'Front Desk' },
              slug: {
                type: 'string',
                pattern: '^[a-z][a-z0-9_]{1,49}$',
                example: 'front_desk',
              },
              description: {
                type: 'string',
                maxLength: 500,
                nullable: true,
                example: 'Reception staff',
              },
              permissions: {
                type: 'array',
                items: { type: 'string', enum: PERMISSION_KEY_ENUM },
                default: [],
                example: ['users.read'],
              },
              isActive: { type: 'boolean', default: true, example: true },
            },
          },
          {
            name: 'Front Desk',
            slug: 'front_desk',
            description: 'Reception staff',
            permissions: ['users.read'],
            isActive: true,
          },
        ),
        responses: {
          ...createdResponse(
            successExample({
              ...roleExample,
              id: '64f0c2a1b4e1c2d3e4f50611',
              name: 'Front Desk',
              slug: 'front_desk',
              description: 'Reception staff',
              permissions: ['users.read'],
              isSystem: false,
            }),
          ),
          ...withErrors(400, 401, 403, 409, 422, 500),
        },
      },
    },

    '/api/v1/roles/{id}': {
      get: {
        tags: ['RBAC'],
        summary: '[Admin] Get role by id',
        description: accessRead,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Role ObjectId')],
        responses: {
          ...okResponse(successExample(roleExample)),
          ...withErrors(401, 403, 404, 422, 500),
        },
      },
      patch: {
        tags: ['RBAC'],
        summary: '[Admin] Update role',
        description: `${accessManage}\n\nSystem role slug cannot be changed.`,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Role ObjectId')],
        requestBody: jsonBody(
          {
            type: 'object',
            minProperties: 1,
            additionalProperties: false,
            properties: {
              name: { type: 'string', minLength: 2, maxLength: 100 },
              slug: { type: 'string', pattern: '^[a-z][a-z0-9_]{1,49}$' },
              description: { type: 'string', maxLength: 500, nullable: true },
              permissions: {
                type: 'array',
                items: { type: 'string', enum: PERMISSION_KEY_ENUM },
              },
              isActive: { type: 'boolean' },
            },
          },
          {
            name: 'Front Desk Lead',
            description: 'Updated description',
            isActive: true,
          },
        ),
        responses: {
          ...okResponse(successExample({ ...roleExample, name: 'Front Desk Lead' })),
          ...withErrors(400, 401, 403, 404, 409, 422, 500),
        },
      },
      delete: {
        tags: ['RBAC'],
        summary: '[Admin] Delete custom role',
        description: `${accessManage}\n\nCannot delete system / super admin roles. Fails with \`ROLE_IN_USE\` if users still have this slug.`,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Role ObjectId')],
        responses: {
          ...noContentResponse(),
          ...withErrors(400, 401, 403, 404, 409, 422, 500),
        },
      },
    },

    '/api/v1/roles/{id}/permissions': {
      put: {
        tags: ['RBAC'],
        summary: '[Admin] Replace role permissions',
        description: accessManage,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Role ObjectId')],
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['permissions'],
            additionalProperties: false,
            properties: {
              permissions: {
                type: 'array',
                items: { type: 'string', enum: PERMISSION_KEY_ENUM },
                example: ['users.read', 'users.update'],
              },
            },
          },
          { permissions: ['users.read', 'users.update'] },
        ),
        responses: {
          ...okResponse(
            successExample({
              ...roleExample,
              permissions: ['users.read', 'users.update'],
            }),
          ),
          ...withErrors(400, 401, 403, 404, 422, 500),
        },
      },
    },

    '/api/v1/permissions': {
      get: {
        tags: ['RBAC'],
        summary: '[Admin] List permissions',
        description: accessPermRead,
        security: bearerSecurity,
        parameters: [
          ...pageQueryParams({ page: 1, limit: 50 }),
          {
            name: 'sort',
            in: 'query',
            schema: { type: 'string', default: 'module', example: 'module' },
          },
          { name: 'module', in: 'query', schema: { type: 'string', example: 'users' } },
          { name: 'isActive', in: 'query', schema: { type: 'boolean', example: true } },
        ],
        responses: {
          ...okResponse(
            successExample([permissionExample], {
              ...paginationMeta,
              total: 8,
              limit: 50,
              sort: 'module',
              filters: { module: 'users' },
            }),
          ),
          ...withErrors(401, 403, 422, 500),
        },
      },
    },

    '/api/v1/permissions/sync': {
      post: {
        tags: ['RBAC'],
        summary: '[Admin] Sync permissions from code registry',
        description: `${accessPermSync}\n\nUpserts all keys from the permission registry into MongoDB. Does not allow free-form key creation.`,
        security: bearerSecurity,
        responses: {
          ...okResponse(
            successExample({
              count: 8,
              items: [permissionExample],
            }),
          ),
          ...withErrors(401, 403, 500),
        },
      },
    },
  },
};
