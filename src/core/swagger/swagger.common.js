/**
 * Shared OpenAPI fragments used by module *.docs.js files.
 * Keep examples valid JSON (no trailing commas) so Swagger "Try it out" works.
 */

export const OBJECT_ID = '507f1f77bcf86cd799439011';
export const ROLE_ID = '64f0c2a1b4e1c2d3e4f50610';
export const JWT_EXAMPLE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1MDdmMWY3N2JjZjg2Y2Q3OTk0MzkwMTEiLCJyb2xlIjoic3VwZXJfYWRtaW4iLCJlbWFpbCI6InN1cGVyYWRtaW5Ac2Fsb24uY29tIn0.signature';

export const GENDER_ENUM = ['MALE', 'FEMALE', 'OTHER'];
export const SYSTEM_ROLE_ENUM = ['super_admin', 'admin', 'customer', 'beautician'];
export const MOBILE_ROLE_ENUM = ['customer', 'beautician'];
export const PERMISSION_KEY_ENUM = [
  'users.read',
  'users.create',
  'users.update',
  'users.delete',
  'roles.read',
  'roles.manage',
  'permissions.read',
  'permissions.sync',
  'banners.read',
  'banners.create',
  'banners.update',
  'banners.delete',
  'filters.read',
  'filters.create',
  'filters.update',
  'filters.delete',
];

export const bearerSecurity = [{ bearerAuth: [] }];
export const publicSecurity = [];

export const userExample = {
  id: OBJECT_ID,
  name: 'Priya Sharma',
  email: 'priya.sharma@example.com',
  phone: '+919876543210',
  role: 'customer',
  profileImage: {
    url: 'https://example.com/uploads/priya.jpg',
    publicId: 'uploads/priya.jpg',
  },
  gender: 'FEMALE',
  dob: '1995-08-14T00:00:00.000Z',
  referralCode: 'PRIYA8X',
  referredBy: null,
  isActive: true,
  lastLoginAt: '2026-07-21T09:30:00.000Z',
  createdAt: '2026-06-01T10:00:00.000Z',
  updatedAt: '2026-07-21T09:30:00.000Z',
};

export const adminUserExample = {
  id: '64f0c2a1b4e1c2d3e4f50601',
  name: 'Super Admin',
  email: 'superadmin@salon.com',
  phone: null,
  role: 'super_admin',
  isActive: true,
  lastLoginAt: '2026-07-24T08:00:00.000Z',
  createdAt: '2026-07-22T10:00:00.000Z',
  updatedAt: '2026-07-24T08:00:00.000Z',
};

export const roleExample = {
  id: ROLE_ID,
  name: 'Admin',
  slug: 'admin',
  description: 'Salon admin with full management permissions',
  permissions: PERMISSION_KEY_ENUM,
  isSystem: true,
  isSuperAdmin: false,
  isActive: true,
  createdAt: '2026-07-22T10:00:00.000Z',
  updatedAt: '2026-07-22T10:00:00.000Z',
};

export const permissionExample = {
  id: '64f0c2a1b4e1c2d3e4f50620',
  key: 'users.read',
  module: 'users',
  action: 'read',
  description: 'List and view users',
  isActive: true,
  createdAt: '2026-07-22T10:00:00.000Z',
  updatedAt: '2026-07-22T10:00:00.000Z',
};

export const paginationMeta = {
  total: 1,
  page: 1,
  limit: 10,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
};

export function successExample(data, meta) {
  const body = { success: true, data };
  if (meta !== undefined) body.meta = meta;
  return body;
}

export function errorExample(code, message, details) {
  const body = { success: false, error: { code, message } };
  if (details !== undefined) body.error.details = details;
  return body;
}

export const standardErrors = {
  400: {
    description: 'Bad Request — invalid JSON or bad input',
    content: {
      'application/json': {
        example: errorExample('BAD_REQUEST', 'Invalid JSON body. Use double quotes and no trailing commas.'),
      },
    },
  },
  401: {
    description: 'Unauthorized — missing/invalid Bearer token or bad credentials',
    content: {
      'application/json': {
        example: errorExample('UNAUTHORIZED', 'Invalid email or password'),
      },
    },
  },
  403: {
    description: 'Forbidden — authenticated but missing permission',
    content: {
      'application/json': {
        example: errorExample('FORBIDDEN', 'Insufficient permissions'),
      },
    },
  },
  404: {
    description: 'Not Found',
    content: {
      'application/json': {
        example: errorExample('NOT_FOUND', 'Resource not found'),
      },
    },
  },
  409: {
    description: 'Conflict — duplicate key or role in use',
    content: {
      'application/json': {
        example: errorExample('CONFLICT', 'Phone already registered', {
          fields: ['phone'],
          keyValue: { phone: '+919811122233' },
        }),
      },
    },
  },
  422: {
    description: 'Unprocessable Entity — Joi validation failed',
    content: {
      'application/json': {
        example: errorExample('VALIDATION_ERROR', 'Validation failed', [
          { field: 'email', message: '"email" is required' },
        ]),
      },
    },
  },
  500: {
    description: 'Internal Server Error',
    content: {
      'application/json': {
        example: errorExample('INTERNAL_ERROR', 'Internal server error'),
      },
    },
  },
};

/**
 * @param {number[]} codes
 */
export function withErrors(...codes) {
  const out = {};
  for (const code of codes) {
    if (standardErrors[code]) out[code] = standardErrors[code];
  }
  return out;
}

export function jsonBody(schema, example) {
  return {
    required: true,
    content: {
      'application/json': {
        schema,
        example,
      },
    },
  };
}

export function okResponse(example, description = 'OK') {
  return {
    200: {
      description,
      content: { 'application/json': { example } },
    },
  };
}

export function createdResponse(example) {
  return {
    201: {
      description: 'Created',
      content: { 'application/json': { example } },
    },
  };
}

export function noContentResponse() {
  return { 204: { description: 'No Content' } };
}

export function objectIdParam(name = 'id', description = 'MongoDB ObjectId (24 hex chars)') {
  return {
    name,
    in: 'path',
    required: true,
    schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$', example: OBJECT_ID },
    description,
  };
}

export function pageQueryParams(defaults = { page: 1, limit: 10 }) {
  return [
    {
      name: 'page',
      in: 'query',
      schema: { type: 'integer', minimum: 1, default: defaults.page, example: defaults.page },
    },
    {
      name: 'limit',
      in: 'query',
      schema: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: defaults.limit,
        example: defaults.limit,
      },
    },
  ];
}

export const openApiComponents = {
  securitySchemes: {
    bearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description:
        'JWT from `POST /api/v1/auth/admin/login` or mobile verify-otp. Click **Authorize** and paste the token (without the word Bearer).',
    },
  },
  schemas: {
    ApiError: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        error: {
          type: 'object',
          properties: {
            code: { type: 'string', example: 'VALIDATION_ERROR' },
            message: { type: 'string' },
            details: { type: 'array', items: { type: 'object' }, nullable: true },
          },
        },
      },
    },
    User: {
      type: 'object',
      properties: {
        id: { type: 'string', example: OBJECT_ID },
        name: { type: 'string', minLength: 2, maxLength: 100 },
        email: { type: 'string', format: 'email', nullable: true },
        phone: { type: 'string', pattern: '^\\+?[1-9]\\d{7,14}$', nullable: true },
        role: { type: 'string', example: 'customer' },
        gender: { type: 'string', enum: GENDER_ENUM, nullable: true },
        dob: { type: 'string', format: 'date-time', nullable: true },
        referralCode: { type: 'string', nullable: true },
        isActive: { type: 'boolean' },
        profileImage: {
          type: 'object',
          properties: {
            url: { type: 'string', nullable: true },
            publicId: { type: 'string', nullable: true },
          },
        },
      },
    },
    Role: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        slug: { type: 'string', pattern: '^[a-z][a-z0-9_]{1,49}$' },
        description: { type: 'string' },
        permissions: { type: 'array', items: { type: 'string', enum: PERMISSION_KEY_ENUM } },
        isSystem: { type: 'boolean' },
        isSuperAdmin: { type: 'boolean' },
        isActive: { type: 'boolean' },
      },
    },
    Permission: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        key: { type: 'string', enum: PERMISSION_KEY_ENUM },
        module: { type: 'string' },
        action: { type: 'string' },
        description: { type: 'string' },
        isActive: { type: 'boolean' },
      },
    },
  },
};
