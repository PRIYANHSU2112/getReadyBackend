import {
  bearerSecurity,
  GENDER_ENUM,
  userExample,
  paginationMeta,
  okResponse,
  createdResponse,
  noContentResponse,
  withErrors,
  successExample,
  objectIdParam,
  pageQueryParams,
} from '../../core/swagger/swagger.common.js';

const accessSelf =
  '**Auth:** Bearer JWT required.\n\n**Permission:** none (authenticated self route).';

const accessRead =
  '**Auth:** Bearer JWT required.\n\n**Permission:** `users.read` (Admin / Beautician by default). Super Admin bypasses. Self-access allowed on `/:id` via `allowSelf`.';

const accessCreate =
  '**Auth:** Bearer JWT required.\n\n**Permission:** `users.create` (Admin by default).';

const accessUpdate =
  '**Auth:** Bearer JWT required.\n\n**Permission:** `users.update` (Admin by default), or self via `allowSelf`.';

const accessDelete =
  '**Auth:** Bearer JWT required.\n\n**Permission:** `users.delete` (Admin by default).';

const createUserSchema = {
  type: 'object',
  required: ['name'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 100, example: 'Ananya Kapoor' },
    email: {
      type: 'string',
      format: 'email',
      description: 'Required when role is admin or super_admin',
      example: 'ops@getready.salon',
    },
    phone: {
      type: 'string',
      pattern: '^\\+?[1-9]\\d{7,14}$',
      description: 'Required when role is customer or beautician',
      example: '+919811122233',
    },
    password: {
      type: 'string',
      minLength: 8,
      maxLength: 128,
      description: 'Required when role is admin or super_admin',
      example: 'TempPass@123',
    },
    role: {
      type: 'string',
      pattern: '^[a-z][a-z0-9_]{1,49}$',
      default: 'customer',
      example: 'customer',
      description: 'Must be an active role slug in the roles collection',
    },
    gender: { type: 'string', enum: GENDER_ENUM, example: 'FEMALE' },
    dob: { type: 'string', format: 'date-time', example: '1998-03-22T00:00:00.000Z' },
    referralCode: { type: 'string', minLength: 4, maxLength: 32, example: 'PRIYA8X' },
    fcmToken: { type: 'string', maxLength: 512 },
    profileImage: {
      type: 'object',
      properties: {
        url: { type: 'string', format: 'uri', nullable: true },
        publicId: { type: 'string', nullable: true },
      },
    },
  },
};

export const userDocs = {
  paths: {
    '/api/v1/users/me': {
      get: {
        tags: ['Users - Self'],
        summary: 'Get my profile',
        description: accessSelf,
        security: bearerSecurity,
        responses: {
          ...okResponse(successExample(userExample)),
          ...withErrors(401, 404, 500),
        },
      },
      patch: {
        tags: ['Users - Self'],
        summary: 'Update my profile',
        description: `${accessSelf}\n\nSupports JSON or multipart. Optional \`file\` uploads profile image (max 5MB). At least one field or a file is required.`,
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                minProperties: 1,
                additionalProperties: false,
                properties: {
                  name: { type: 'string', minLength: 2, maxLength: 100, example: 'Priya Sharma' },
                  gender: { type: 'string', enum: GENDER_ENUM, nullable: true, example: 'FEMALE' },
                  dob: {
                    type: 'string',
                    format: 'date-time',
                    nullable: true,
                    example: '1995-08-14T00:00:00.000Z',
                  },
                  fcmToken: { type: 'string', maxLength: 512, nullable: true },
                },
              },
              example: {
                name: 'Priya Sharma',
                gender: 'FEMALE',
                fcmToken: 'fcm_updated_token_xyz',
              },
            },
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  gender: { type: 'string', enum: GENDER_ENUM },
                  dob: { type: 'string', format: 'date-time' },
                  fcmToken: { type: 'string' },
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'Profile image (jpeg/png/webp/gif), max 5MB',
                  },
                },
              },
            },
          },
        },
        responses: {
          ...okResponse(successExample(userExample)),
          ...withErrors(400, 401, 422, 500),
        },
      },
    },

    '/api/v1/users': {
      get: {
        tags: ['Users - Admin / Beautician'],
        summary: '[Admin / Beautician] List users',
        description: accessRead,
        security: bearerSecurity,
        parameters: [
          ...pageQueryParams({ page: 1, limit: 10 }),
          {
            name: 'sort',
            in: 'query',
            schema: {
              type: 'string',
              default: '-createdAt',
              enum: ['createdAt', '-createdAt', 'name', '-name', 'lastLoginAt', '-lastLoginAt'],
              example: '-createdAt',
            },
          },
          { name: 'search', in: 'query', schema: { type: 'string', example: 'priya' } },
          {
            name: 'role',
            in: 'query',
            schema: {
              type: 'string',
              pattern: '^[a-z][a-z0-9_]{1,49}$',
              example: 'customer',
            },
          },
          { name: 'isActive', in: 'query', schema: { type: 'boolean', example: true } },
          {
            name: 'gender',
            in: 'query',
            schema: { type: 'string', enum: GENDER_ENUM, example: 'FEMALE' },
          },
          {
            name: 'createdFrom',
            in: 'query',
            schema: { type: 'string', format: 'date-time', example: '2026-01-01T00:00:00.000Z' },
          },
          {
            name: 'createdTo',
            in: 'query',
            schema: { type: 'string', format: 'date-time', example: '2026-12-31T23:59:59.999Z' },
          },
          { name: 'hasReferral', in: 'query', schema: { type: 'boolean', example: false } },
        ],
        responses: {
          ...okResponse(
            successExample([userExample], {
              ...paginationMeta,
              sort: '-createdAt',
              filters: { search: 'priya', role: 'customer' },
            }),
          ),
          ...withErrors(401, 403, 422, 500),
        },
      },
      post: {
        tags: ['Users - Admin'],
        summary: '[Admin] Create user',
        description: `${accessCreate}\n\n**Rules:** customer/beautician require \`phone\`; admin/super_admin require \`email\` + \`password\` (min 8).\n\n**Try it out:** change \`phone\` / \`email\` each time — they must be unique (409 if already used).`,
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: createUserSchema,
              examples: {
                customer: {
                  summary: 'Customer (phone required)',
                  value: {
                    name: 'Ananya Kapoor',
                    phone: '+919811122233',
                    role: 'customer',
                    gender: 'FEMALE',
                    dob: '1998-03-22T00:00:00.000Z',
                  },
                },
                beautician: {
                  summary: 'Beautician (phone required)',
                  value: {
                    name: 'Neha Verma',
                    phone: '+919822233344',
                    role: 'beautician',
                    gender: 'FEMALE',
                  },
                },
                admin: {
                  summary: 'Admin (email + password required)',
                  value: {
                    name: 'Salon Ops',
                    email: 'ops@getready.salon',
                    password: 'TempPass@123',
                    role: 'admin',
                  },
                },
              },
            },
          },
        },
        responses: {
          ...createdResponse(successExample({ ...userExample, name: 'Ananya Kapoor', phone: '+919811122233' })),
          ...withErrors(400, 401, 403, 409, 422, 500),
        },
      },
    },

    '/api/v1/users/{id}': {
      get: {
        tags: ['Users - Admin / Beautician'],
        summary: '[Admin / Beautician] Get user by id',
        description: accessRead,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'User ObjectId')],
        responses: {
          ...okResponse(successExample(userExample)),
          ...withErrors(401, 403, 404, 422, 500),
        },
      },
      patch: {
        tags: ['Users - Admin'],
        summary: '[Admin] Update user by id',
        description: `${accessUpdate}\n\nJSON or multipart. Optional \`file\` for profile image.`,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'User ObjectId')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                minProperties: 1,
                additionalProperties: false,
                properties: {
                  name: { type: 'string', minLength: 2, maxLength: 100, example: 'Priya S.' },
                  email: { type: 'string', format: 'email' },
                  phone: { type: 'string', pattern: '^\\+?[1-9]\\d{7,14}$' },
                  password: { type: 'string', minLength: 8, maxLength: 128 },
                  role: { type: 'string', pattern: '^[a-z][a-z0-9_]{1,49}$', example: 'customer' },
                  isActive: { type: 'boolean', example: true },
                  gender: { type: 'string', enum: GENDER_ENUM, nullable: true },
                  dob: { type: 'string', format: 'date-time', nullable: true },
                  fcmToken: { type: 'string', maxLength: 512, nullable: true },
                },
              },
              example: {
                name: 'Priya S.',
                gender: 'FEMALE',
                isActive: true,
              },
            },
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  phone: { type: 'string' },
                  password: { type: 'string' },
                  role: { type: 'string' },
                  isActive: { type: 'boolean' },
                  gender: { type: 'string', enum: GENDER_ENUM },
                  dob: { type: 'string' },
                  fcmToken: { type: 'string' },
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'Profile image (jpeg/png/webp/gif), max 5MB',
                  },
                },
              },
            },
          },
        },
        responses: {
          ...okResponse(successExample({ ...userExample, name: 'Priya S.' })),
          ...withErrors(400, 401, 403, 404, 409, 422, 500),
        },
      },
      delete: {
        tags: ['Users - Admin'],
        summary: '[Admin] Soft-delete user',
        description: accessDelete,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'User ObjectId')],
        responses: {
          ...noContentResponse(),
          ...withErrors(401, 403, 404, 422, 500),
        },
      },
    },
  },
};
