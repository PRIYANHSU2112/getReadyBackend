import {
  publicSecurity,
  bearerSecurity,
  adminUserExample,
  JWT_EXAMPLE,
  MOBILE_ROLE_ENUM,
  userExample,
  jsonBody,
  okResponse,
  withErrors,
  successExample,
} from '../../core/swagger/swagger.common.js';

const loginSchema = {
  type: 'object',
  required: ['email', 'password'],
  additionalProperties: false,
  properties: {
    email: {
      type: 'string',
      format: 'email',
      example: 'superadmin@salon.com',
      description: 'Admin or Super Admin email',
    },
    password: {
      type: 'string',
      example: 'SuperAdmin@123',
      description: 'Account password',
    },
  },
};

const loginExample = {
  email: 'superadmin@salon.com',
  password: 'SuperAdmin@123',
};

const loginSuccess = successExample({
  token: JWT_EXAMPLE,
  user: adminUserExample,
});

export const authDocs = {
  paths: {
    '/api/v1/auth/admin/login': {
      post: {
        tags: ['Auth - Admin'],
        summary: 'Admin / Super Admin login',
        description:
          'Returns a JWT. Use **Authorize** with the token for protected routes. Accepts roles `admin` and `super_admin`.',
        security: publicSecurity,
        requestBody: jsonBody(loginSchema, loginExample),
        responses: {
          ...okResponse(loginSuccess, 'Login successful'),
          ...withErrors(400, 401, 422, 500),
        },
      },
    },

    '/api/v1/auth/login': {
      post: {
        tags: ['Auth - Admin'],
        summary: 'Admin login (alias of /admin/login)',
        description: 'Same as `POST /api/v1/auth/admin/login`.',
        security: publicSecurity,
        requestBody: jsonBody(loginSchema, loginExample),
        responses: {
          ...okResponse(loginSuccess, 'Login successful'),
          ...withErrors(400, 401, 422, 500),
        },
      },
    },

    '/api/v1/auth/admin/forgot-password': {
      post: {
        tags: ['Auth - Admin'],
        summary: 'Request password-reset OTP',
        description:
          'Always returns a generic message (does not reveal whether the email exists). OTP is sent for admin/super_admin accounts.',
        security: publicSecurity,
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['email'],
            additionalProperties: false,
            properties: {
              email: { type: 'string', format: 'email', example: 'superadmin@salon.com' },
            },
          },
          { email: 'superadmin@salon.com' },
        ),
        responses: {
          ...okResponse(
            successExample({ message: 'If the email exists, an OTP has been sent' }),
          ),
          ...withErrors(400, 422, 500),
        },
      },
    },

    '/api/v1/auth/admin/reset-password': {
      post: {
        tags: ['Auth - Admin'],
        summary: 'Reset password with OTP',
        security: publicSecurity,
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['email', 'otp', 'newPassword'],
            additionalProperties: false,
            properties: {
              email: { type: 'string', format: 'email', example: 'superadmin@salon.com' },
              otp: {
                type: 'string',
                pattern: '^\\d{6}$',
                minLength: 6,
                maxLength: 6,
                example: '123456',
              },
              newPassword: {
                type: 'string',
                minLength: 8,
                maxLength: 128,
                example: 'NewPass@12345',
              },
            },
          },
          {
            email: 'superadmin@salon.com',
            otp: '123456',
            newPassword: 'NewPass@12345',
          },
        ),
        responses: {
          ...okResponse(
            successExample({
              message: 'Password reset successful',
              user: adminUserExample,
            }),
          ),
          ...withErrors(400, 422, 500),
        },
      },
    },

    '/api/v1/auth/mobile/send-otp': {
      post: {
        tags: ['Auth - Mobile'],
        summary: 'Send login OTP (customer / beautician)',
        security: publicSecurity,
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['phone', 'role'],
            additionalProperties: false,
            properties: {
              phone: {
                type: 'string',
                pattern: '^\\+?[1-9]\\d{7,14}$',
                example: '+919876543210',
              },
              role: { type: 'string', enum: MOBILE_ROLE_ENUM, example: 'customer' },
            },
          },
          { phone: '+919876543210', role: 'customer' },
        ),
        responses: {
          ...okResponse(
            successExample({ message: 'OTP sent successfully', expiresIn: 300 }),
          ),
          ...withErrors(400, 422, 500),
        },
      },
    },

    '/api/v1/auth/mobile/resend-otp': {
      post: {
        tags: ['Auth - Mobile'],
        summary: 'Resend login OTP',
        security: publicSecurity,
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['phone', 'role'],
            additionalProperties: false,
            properties: {
              phone: {
                type: 'string',
                pattern: '^\\+?[1-9]\\d{7,14}$',
                example: '+919876543210',
              },
              role: { type: 'string', enum: MOBILE_ROLE_ENUM, example: 'customer' },
            },
          },
          { phone: '+919876543210', role: 'customer' },
        ),
        responses: {
          ...okResponse(
            successExample({ message: 'OTP sent successfully', expiresIn: 300 }),
          ),
          ...withErrors(400, 422, 500),
        },
      },
    },

    '/api/v1/auth/mobile/verify-otp': {
      post: {
        tags: ['Auth - Mobile'],
        summary: 'Verify OTP and login / register',
        description:
          'Creates the user on first successful verify if they do not exist. `name` is optional (defaults to "User").',
        security: publicSecurity,
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['phone', 'otp', 'role'],
            additionalProperties: false,
            properties: {
              phone: {
                type: 'string',
                pattern: '^\\+?[1-9]\\d{7,14}$',
                example: '+919876543210',
              },
              otp: {
                type: 'string',
                pattern: '^\\d{6}$',
                minLength: 6,
                maxLength: 6,
                example: '123456',
              },
              role: { type: 'string', enum: MOBILE_ROLE_ENUM, example: 'customer' },
              name: {
                type: 'string',
                minLength: 2,
                maxLength: 100,
                description: 'Optional. Defaults to "User" on first register.',
              },
              referralCode: {
                type: 'string',
                minLength: 4,
                maxLength: 32,
                example: 'WELCOME1',
              },
              fcmToken: { type: 'string', maxLength: 512 },
            },
          },
          {
            phone: '+919876543210',
            otp: '123456',
            role: 'customer',
          },
        ),
        responses: {
          ...okResponse(
            successExample({
              token: JWT_EXAMPLE,
              user: userExample,
            }),
          ),
          ...withErrors(400, 422, 500),
        },
      },
    },

    '/api/v1/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current authenticated user',
        security: bearerSecurity,
        responses: {
          ...okResponse(successExample(adminUserExample)),
          ...withErrors(401, 404, 500),
        },
      },
    },
  },
};
