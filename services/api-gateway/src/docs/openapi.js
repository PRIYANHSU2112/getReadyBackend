export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'GetReady Microservices API Documentation',
    version: '2.0.0',
    description: `### GetReady Salon & Beautician On-Demand Platform API
Central API Gateway documentation for all GetReady microservices.

#### Authentication
Most endpoints require a **Bearer JWT Token** in the \`Authorization\` header:
\`\`\`http
Authorization: Bearer <your_jwt_token>
\`\`\`
1. Login via \`/api/v1/auth/admin/login\` or \`/api/v1/auth/mobile/verify-otp\`.
2. Copy the \`token\` from response.
3. Click the **Authorize 🔓** button on top right and paste the token.
`,
    contact: {
      name: 'GetReady Engineering Team',
      email: 'support@getready.com',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'API Gateway (Local)',
    },
    {
      url: 'http://localhost:8080',
      description: 'API Gateway (Alternative Port)',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT access token without the "Bearer " prefix.',
      },
    },
    responses: {
      UnauthorizedError: {
        description: 'Access token is missing or invalid',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', example: 'UNAUTHORIZED' },
                    message: { type: 'string', example: 'Invalid or expired token' },
                  },
                },
              },
            },
          },
        },
      },
      NotFoundError: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', example: 'NOT_FOUND' },
                    message: { type: 'string', example: 'Resource not found' },
                  },
                },
              },
            },
          },
        },
      },
      SuccessEnvelope: {
        description: 'Standard Success Response',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                data: { type: 'object' },
                meta: { type: 'object' },
              },
            },
          },
        },
      },
    },
  },
  tags: [
    { name: 'Auth', description: 'Authentication & Session Management' },
    { name: 'Users', description: 'User Profile & Management' },
    { name: 'Addresses', description: 'Saved Customer Addresses' },
    { name: 'Family Members', description: 'Customer Family Members' },
    { name: 'Roles & RBAC', description: 'Role-based Access Control & Permissions' },
    { name: 'Beautician Profiles', description: 'Beautician Profiles, Verification & Work History' },
    { name: 'Beautician Skills', description: 'Skills & Service Expertise' },
    { name: 'Bank Details', description: 'Partner Bank & Payout Details' },
    { name: 'Categories', description: 'Service Categories Management' },
    { name: 'Services', description: 'Catalog Services Management' },
    { name: 'Service Change Requests', description: 'Vendor/Staff Service Modifications' },
    { name: 'Packages', description: 'Combo Packages & Bundles' },
    { name: 'Filters', description: 'Catalog Dynamic Attributes & Filters' },
    { name: 'Hygiene Kits', description: 'Safety & Hygiene Kit Management' },
    { name: 'Slots', description: 'Time Slots & Real-time Hold/Release' },
    { name: 'Bookings', description: 'Order Bookings, Scheduling & Status' },
    { name: 'Calendar', description: 'Admin Schedule Calendar, Multi-View, Availability & Conflicts' },
    { name: 'Cart', description: 'Shopping Cart, Multi-person booking & Instructions' },
    { name: 'Payments', description: 'Razorpay Checkout & Webhooks' },
    { name: 'Wallet & Loyalty', description: 'Recharge, Cashback & Loyalty Points' },
    { name: 'Notifications', description: 'In-app & Push Notifications' },
    { name: 'Banners', description: 'Promotional Banners & Sliders' },
    { name: 'Blogs', description: 'Articles, Beauty Tips & Stories' },
    { name: 'System', description: 'Gateway Health & Monitoring' },
  ],
  paths: {
    // ------------------------------------------------------------------------
    // SYSTEM / HEALTH
    // ------------------------------------------------------------------------
    '/health': {
      get: {
        tags: ['System'],
        summary: 'API Gateway Health Check',
        responses: {
          200: { $ref: '#/components/responses/SuccessEnvelope' },
        },
      },
    },
    '/ready': {
      get: {
        tags: ['System'],
        summary: 'API Gateway Readiness Probe',
        responses: {
          200: { $ref: '#/components/responses/SuccessEnvelope' },
        },
      },
    },
    '/metrics': {
      get: {
        tags: ['System'],
        summary: 'Prometheus Metrics',
        responses: {
          200: { description: 'Prometheus metrics text format' },
        },
      },
    },

    // ------------------------------------------------------------------------
    // AUTH SERVICE
    // ------------------------------------------------------------------------
    '/api/v1/auth/admin/login': {
      post: {
        tags: ['Auth'],
        summary: 'Admin & Super Admin Login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'superadmin@salon.com' },
                  password: { type: 'string', example: 'SuperAdmin@123' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Login successful with JWT access and refresh token' },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/api/v1/auth/admin/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Admin Forgot Password Request',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', example: 'admin@salon.com' },
                },
              },
            },
          },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/auth/admin/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Admin Reset Password with Token/OTP',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'otp', 'newPassword'],
                properties: {
                  email: { type: 'string', example: 'admin@salon.com' },
                  otp: { type: 'string', example: '123456' },
                  newPassword: { type: 'string', example: 'NewPass@123' },
                },
              },
            },
          },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/auth/mobile/send-otp': {
      post: {
        tags: ['Auth'],
        summary: 'Send Mobile OTP (Customer / Beautician)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['mobile'],
                properties: {
                  mobile: { type: 'string', example: '9876543210' },
                  role: { type: 'string', enum: ['customer', 'beautician'], default: 'customer' },
                },
              },
            },
          },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/auth/mobile/resend-otp': {
      post: {
        tags: ['Auth'],
        summary: 'Resend Mobile OTP',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['mobile'],
                properties: {
                  mobile: { type: 'string', example: '9876543210' },
                },
              },
            },
          },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/auth/mobile/verify-otp': {
      post: {
        tags: ['Auth'],
        summary: 'Verify Mobile OTP & Authenticate',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['mobile', 'otp'],
                properties: {
                  mobile: { type: 'string', example: '9876543210' },
                  otp: { type: 'string', example: '123456' },
                  role: { type: 'string', enum: ['customer', 'beautician'], default: 'customer' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Authenticated with token' } },
      },
    },
    '/api/v1/auth/refresh-token': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh Access Token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                  refreshToken: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'New access token granted' } },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'User Logout',
        security: [{ BearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  refreshToken: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get Current Authenticated User Session',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { $ref: '#/components/responses/SuccessEnvelope' },
          401: { $ref: '#/components/responses/UnauthorizedError' },
        },
      },
    },

    // ------------------------------------------------------------------------
    // USER SERVICE
    // ------------------------------------------------------------------------
    '/api/v1/users/me': {
      get: {
        tags: ['Users'],
        summary: 'Get My Profile',
        security: [{ BearerAuth: [] }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      patch: {
        tags: ['Users'],
        summary: 'Update My Profile',
        security: [{ BearerAuth: [] }],
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  fullName: { type: 'string' },
                  email: { type: 'string' },
                  profileImage: { type: 'string', format: 'binary' },
                  gender: { type: 'string', enum: ['male', 'female', 'other'] },
                },
              },
            },
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  fullName: { type: 'string' },
                  email: { type: 'string' },
                  gender: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/users': {
      get: {
        tags: ['Users'],
        summary: 'List Users (Admin)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
          { name: 'role', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      post: {
        tags: ['Users'],
        summary: 'Create User (Admin)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['fullName', 'mobile'],
                properties: {
                  fullName: { type: 'string' },
                  mobile: { type: 'string' },
                  email: { type: 'string' },
                  role: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 201: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/users/{id}': {
      get: {
        tags: ['Users'],
        summary: 'Get User By ID',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      patch: {
        tags: ['Users'],
        summary: 'Update User By ID',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object' },
            },
          },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      delete: {
        tags: ['Users'],
        summary: 'Soft Delete User',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },

    // ------------------------------------------------------------------------
    // ADDRESSES
    // ------------------------------------------------------------------------
    '/api/v1/addresses': {
      get: {
        tags: ['Addresses'],
        summary: 'List Saved Addresses',
        security: [{ BearerAuth: [] }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      post: {
        tags: ['Addresses'],
        summary: 'Add New Address',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['streetAddress', 'city', 'state', 'pincode'],
                properties: {
                  type: { type: 'string', enum: ['Home', 'Work', 'Other'], default: 'Home' },
                  streetAddress: { type: 'string', example: 'Flat 101, Sunshine Heights' },
                  landmark: { type: 'string', example: 'Near City Mall' },
                  city: { type: 'string', example: 'Mumbai' },
                  state: { type: 'string', example: 'Maharashtra' },
                  pincode: { type: 'string', example: '400001' },
                  isDefault: { type: 'boolean', default: false },
                },
              },
            },
          },
        },
        responses: { 201: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/addresses/{id}': {
      get: {
        tags: ['Addresses'],
        summary: 'Get Address By ID',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      patch: {
        tags: ['Addresses'],
        summary: 'Update Address',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      delete: {
        tags: ['Addresses'],
        summary: 'Delete Address',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/addresses/{id}/default': {
      put: {
        tags: ['Addresses'],
        summary: 'Set As Default Address',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },

    // ------------------------------------------------------------------------
    // FAMILY MEMBERS
    // ------------------------------------------------------------------------
    '/api/v1/members': {
      get: {
        tags: ['Family Members'],
        summary: 'List Family Members',
        security: [{ BearerAuth: [] }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      post: {
        tags: ['Family Members'],
        summary: 'Add Family Member',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['fullName', 'relation'],
                properties: {
                  fullName: { type: 'string', example: 'Priya Sharma' },
                  relation: { type: 'string', example: 'Sister' },
                  gender: { type: 'string', enum: ['male', 'female', 'other'], default: 'female' },
                  age: { type: 'integer', example: 24 },
                },
              },
            },
          },
        },
        responses: { 201: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/members/{id}': {
      get: {
        tags: ['Family Members'],
        summary: 'Get Family Member',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      patch: {
        tags: ['Family Members'],
        summary: 'Update Family Member',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      delete: {
        tags: ['Family Members'],
        summary: 'Delete Family Member',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },

    // ------------------------------------------------------------------------
    // ROLES & RBAC
    // ------------------------------------------------------------------------
    '/api/v1/roles': {
      get: {
        tags: ['Roles & RBAC'],
        summary: 'List Roles',
        security: [{ BearerAuth: [] }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      post: {
        tags: ['Roles & RBAC'],
        summary: 'Create Role',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'permissions'],
                properties: {
                  name: { type: 'string', example: 'Manager' },
                  description: { type: 'string' },
                  permissions: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: { 201: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/roles/{id}': {
      get: {
        tags: ['Roles & RBAC'],
        summary: 'Get Role by ID',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      patch: {
        tags: ['Roles & RBAC'],
        summary: 'Update Role',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      delete: {
        tags: ['Roles & RBAC'],
        summary: 'Delete Role',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/permissions': {
      get: {
        tags: ['Roles & RBAC'],
        summary: 'List All System Permissions',
        security: [{ BearerAuth: [] }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/permissions/sync': {
      post: {
        tags: ['Roles & RBAC'],
        summary: 'Sync Default Permissions',
        security: [{ BearerAuth: [] }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },

    // ------------------------------------------------------------------------
    // BEAUTICIAN PROFILES & KYC
    // ------------------------------------------------------------------------
    '/api/v1/beautician-profiles/me': {
      get: {
        tags: ['Beautician Profiles'],
        summary: 'Get My Beautician Profile',
        security: [{ BearerAuth: [] }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      patch: {
        tags: ['Beautician Profiles'],
        summary: 'Update My Profile Information',
        security: [{ BearerAuth: [] }],
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/beautician-profiles': {
      get: {
        tags: ['Beautician Profiles'],
        summary: 'List All Beautician Profiles (Admin)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['draft', 'submitted', 'approved', 'rejected'] } },
        ],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      post: {
        tags: ['Beautician Profiles'],
        summary: 'Create / Onboard Beautician Profile',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['experienceYears', 'bio'],
                properties: {
                  experienceYears: { type: 'number', example: 5 },
                  bio: { type: 'string', example: 'Certified hair stylist with 5+ years experience' },
                  skills: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: { 201: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/beautician-profiles/{id}': {
      get: {
        tags: ['Beautician Profiles'],
        summary: 'Get Beautician Profile By ID',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/beautician-profiles/me/selfie': {
      post: {
        tags: ['Beautician Profiles'],
        summary: 'Upload KYC Documents & Selfie',
        security: [{ BearerAuth: [] }],
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  profilePhoto: { type: 'string', format: 'binary' },
                  idCardFront: { type: 'string', format: 'binary' },
                  idCardBack: { type: 'string', format: 'binary' },
                  selfieWithId: { type: 'string', format: 'binary' },
                },
              },
            },
          },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/beautician-profiles/me/submit': {
      post: {
        tags: ['Beautician Profiles'],
        summary: 'Submit Profile For Admin Approval',
        security: [{ BearerAuth: [] }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/beautician-profiles/{id}/review': {
      patch: {
        tags: ['Beautician Profiles'],
        summary: 'Admin Review & Approve/Reject Profile',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['approved', 'rejected'] },
                  rejectionReason: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/beautician-profiles/{id}/kyc-review': {
      patch: {
        tags: ['Beautician Profiles'],
        summary: 'Admin Review KYC Status',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['verified', 'rejected'] },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },

    // ------------------------------------------------------------------------
    // BEAUTICIAN SKILLS
    // ------------------------------------------------------------------------
    '/api/v1/skills': {
      get: {
        tags: ['Beautician Skills'],
        summary: 'List Skills',
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      post: {
        tags: ['Beautician Skills'],
        summary: 'Create Skill (Admin)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', example: 'Bridal Makeup' },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 201: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/skills/{id}': {
      get: {
        tags: ['Beautician Skills'],
        summary: 'Get Skill by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      patch: {
        tags: ['Beautician Skills'],
        summary: 'Update Skill',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      delete: {
        tags: ['Beautician Skills'],
        summary: 'Delete Skill',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },

    // ------------------------------------------------------------------------
    // BANK DETAILS
    // ------------------------------------------------------------------------
    '/api/v1/bank-details/me': {
      get: {
        tags: ['Bank Details'],
        summary: 'Get My Bank Account Details',
        security: [{ BearerAuth: [] }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      put: {
        tags: ['Bank Details'],
        summary: 'Add / Update Bank Account Details',
        security: [{ BearerAuth: [] }],
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  accountHolderName: { type: 'string', example: 'Pooja Verma' },
                  accountNumber: { type: 'string', example: '123456789012' },
                  ifscCode: { type: 'string', example: 'HDFC0001234' },
                  bankName: { type: 'string', example: 'HDFC Bank' },
                  file: { type: 'string', format: 'binary', description: 'Cancelled Cheque/Passbook' },
                },
              },
            },
          },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      delete: {
        tags: ['Bank Details'],
        summary: 'Delete Bank Account Details',
        security: [{ BearerAuth: [] }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },

    // ------------------------------------------------------------------------
    // CATALOG: CATEGORIES
    // ------------------------------------------------------------------------
    '/api/v1/categories/public': {
      get: {
        tags: ['Categories'],
        summary: 'List Active Public Categories (Client/App)',
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/categories/public/{slug}': {
      get: {
        tags: ['Categories'],
        summary: 'Get Public Category by Slug',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/categories': {
      get: {
        tags: ['Categories'],
        summary: 'List All Categories (Admin with filters & pagination)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      post: {
        tags: ['Categories'],
        summary: 'Create Category (Admin)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', example: 'Hair Care & Styling' },
                  description: { type: 'string' },
                  file: { type: 'string', format: 'binary', description: 'Category Icon/Image' },
                  order: { type: 'integer', default: 0 },
                },
              },
            },
          },
        },
        responses: { 201: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/categories/{id}': {
      get: {
        tags: ['Categories'],
        summary: 'Get Category By ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      patch: {
        tags: ['Categories'],
        summary: 'Update Category',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'multipart/form-data': { schema: { type: 'object' } },
            'application/json': { schema: { type: 'object' } },
          },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      delete: {
        tags: ['Categories'],
        summary: 'Delete Category (Soft Delete)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/categories/{id}/status': {
      patch: {
        tags: ['Categories'],
        summary: 'Toggle Category Active Status',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['isActive'],
                properties: { isActive: { type: 'boolean' } },
              },
            },
          },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/categories/reorder': {
      patch: {
        tags: ['Categories'],
        summary: 'Reorder Categories Priority',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['orderedIds'],
                properties: { orderedIds: { type: 'array', items: { type: 'string' } } },
              },
            },
          },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },

    // ------------------------------------------------------------------------
    // CATALOG: SERVICES
    // ------------------------------------------------------------------------
    '/api/v1/services/public': {
      get: {
        tags: ['Services'],
        summary: 'List Public Services (Search & Filter)',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'categoryId', in: 'query', schema: { type: 'string' } },
          { name: 'gender', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/services/public/category/{categoryId}': {
      get: {
        tags: ['Services'],
        summary: 'List Services By Category',
        parameters: [{ name: 'categoryId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/services/public/{slug}': {
      get: {
        tags: ['Services'],
        summary: 'Get Service Details by Slug',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/services': {
      get: {
        tags: ['Services'],
        summary: 'List All Services (Admin)',
        security: [{ BearerAuth: [] }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      post: {
        tags: ['Services'],
        summary: 'Create Service (Admin)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['name', 'categoryId', 'price', 'durationMinutes'],
                properties: {
                  name: { type: 'string', example: 'Diamond Facial' },
                  categoryId: { type: 'string' },
                  price: { type: 'number', example: 1499 },
                  discountPrice: { type: 'number', example: 1199 },
                  durationMinutes: { type: 'number', example: 60 },
                  description: { type: 'string' },
                  thumbnail: { type: 'string', format: 'binary' },
                  images: { type: 'array', items: { type: 'string', format: 'binary' } },
                },
              },
            },
          },
        },
        responses: { 201: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/services/{id}': {
      get: {
        tags: ['Services'],
        summary: 'Get Service by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      patch: {
        tags: ['Services'],
        summary: 'Update Service',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: { 'multipart/form-data': { schema: { type: 'object' } } },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      delete: {
        tags: ['Services'],
        summary: 'Delete Service',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/services/{id}/approve': {
      post: {
        tags: ['Services'],
        summary: 'Approve Service Creation/Update',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/services/{id}/reject': {
      post: {
        tags: ['Services'],
        summary: 'Reject Service',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },

    // ------------------------------------------------------------------------
    // PACKAGES
    // ------------------------------------------------------------------------
    '/api/v1/packages/public': {
      get: {
        tags: ['Packages'],
        summary: 'List Public Packages',
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/packages': {
      get: {
        tags: ['Packages'],
        summary: 'List Packages (Admin)',
        security: [{ BearerAuth: [] }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      post: {
        tags: ['Packages'],
        summary: 'Create Package Deal',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['name', 'price'],
                properties: {
                  name: { type: 'string', example: 'Bridal Glow Combo' },
                  price: { type: 'number', example: 4999 },
                  discountPrice: { type: 'number', example: 3999 },
                  services: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: { 201: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/packages/{id}': {
      delete: {
        tags: ['Packages'],
        summary: 'Delete Package',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },

    // ------------------------------------------------------------------------
    // SLOTS & BOOKING
    // ------------------------------------------------------------------------
    '/api/v1/slots/available': {
      get: {
        tags: ['Slots'],
        summary: 'Get Real-time Available Slots',
        parameters: [
          { name: 'date', in: 'query', required: true, schema: { type: 'string', format: 'date', example: '2026-09-12' } },
          { name: 'serviceId', in: 'query', schema: { type: 'string' } },
          { name: 'beauticianId', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/slots/hold': {
      post: {
        tags: ['Slots'],
        summary: 'Hold Time Slot (10-minute Lock for Checkout)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['slotId', 'date'],
                properties: {
                  slotId: { type: 'string' },
                  date: { type: 'string', example: '2026-09-12' },
                },
              },
            },
          },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/slots/release': {
      post: {
        tags: ['Slots'],
        summary: 'Release Held Slot',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['slotId'],
                properties: { slotId: { type: 'string' } },
              },
            },
          },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },

    // ------------------------------------------------------------------------
    // BOOKINGS & ORCHESTRATION
    // ------------------------------------------------------------------------
    '/api/v1/bookings/preview': {
      post: {
        tags: ['Bookings'],
        summary: 'Authoritative Pre-booking Calculation & Quote Preview',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['items'],
                properties: {
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['serviceId', 'basePrice'],
                      properties: {
                        serviceId: { type: 'string' },
                        serviceName: { type: 'string' },
                        basePrice: { type: 'number' },
                        quantity: { type: 'integer', default: 1 },
                        customerProfileId: { type: 'string' },
                        upgradeSelected: { type: 'boolean', default: false },
                        upgradeServiceId: { type: 'string' },
                        upgradePriceDifference: { type: 'number' },
                      },
                    },
                  },
                  participants: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        customerProfileId: { type: 'string' },
                        name: { type: 'string' },
                        relationship: { type: 'string', example: 'Mother' },
                      },
                    },
                  },
                  hygieneKitQuantity: { type: 'integer', default: 1 },
                  membershipOptIn: { type: 'boolean', default: false },
                  couponCode: { type: 'string', example: 'FLAT300' },
                  useWallet: { type: 'boolean', default: false },
                  preferredBeauticianCount: { type: 'integer', enum: [1, 2], default: 1 },
                },
              },
            },
          },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/bookings': {
      post: {
        tags: ['Bookings'],
        summary: 'Create Authoritative Multi-Customer / Multi-Beautician Booking Order',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['addressId', 'addressSnapshot', 'participants', 'items'],
                properties: {
                  idempotencyKey: { type: 'string', example: 'req_123456789' },
                  schedulingMode: { type: 'string', enum: ['INSTANT', 'SCHEDULED'], default: 'SCHEDULED' },
                  slotId: { type: 'string' },
                  scheduledDate: { type: 'string', example: '2026-09-12' },
                  addressId: { type: 'string' },
                  addressSnapshot: { type: 'object' },
                  preferredBeauticianCount: { type: 'integer', enum: [1, 2], default: 1 },
                  participants: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['name'],
                      properties: {
                        customerProfileId: { type: 'string' },
                        name: { type: 'string', example: 'Self' },
                        relationship: { type: 'string', example: 'Self' },
                      },
                    },
                  },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['serviceId', 'basePrice'],
                      properties: {
                        serviceId: { type: 'string' },
                        serviceName: { type: 'string' },
                        basePrice: { type: 'number' },
                        quantity: { type: 'integer', default: 1 },
                        customerProfileId: { type: 'string' },
                        upgradeSelected: { type: 'boolean', default: false },
                        upgradeServiceId: { type: 'string' },
                        upgradePriceDifference: { type: 'number' },
                      },
                    },
                  },
                  hygieneKitQuantity: { type: 'integer', default: 1 },
                  couponCode: { type: 'string', example: 'FLAT300' },
                  useWallet: { type: 'boolean', default: false },
                  paymentMethod: { type: 'string', enum: ['online', 'wallet', 'cod', 'mixed'], default: 'online' },
                  specialInstructions: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 201: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/bookings/my': {
      get: {
        tags: ['Bookings'],
        summary: 'Get My Bookings (Account Owner)',
        security: [{ BearerAuth: [] }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/bookings/beautician/my-assignments': {
      get: {
        tags: ['Bookings'],
        summary: 'Beautician View Isolation (Only assigned services and customer profiles)',
        security: [{ BearerAuth: [] }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/bookings/admin': {
      get: {
        tags: ['Bookings'],
        summary: 'List All Bookings (Admin)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/bookings/admin/settings': {
      get: {
        tags: ['Bookings'],
        summary: 'Get Admin Configurable Booking Settings',
        security: [{ BearerAuth: [] }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      put: {
        tags: ['Bookings'],
        summary: 'Update Admin Booking Settings',
        security: [{ BearerAuth: [] }],
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/bookings/{id}': {
      get: {
        tags: ['Bookings'],
        summary: 'Get Booking Details by ID',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/bookings/{id}/start-otp/verify': {
      post: {
        tags: ['Bookings'],
        summary: 'Verify Single Common Start OTP (Transitions booking & items to STARTED)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['otp'],
                properties: { otp: { type: 'string', example: '1234' } },
              },
            },
          },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/bookings/{id}/items/{itemId}/complete': {
      post: {
        tags: ['Bookings'],
        summary: 'Beautician Marks Individual Service Item Complete',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'itemId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { notes: { type: 'string', example: 'Hydrating facial applied' } },
              },
            },
          },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/bookings/{id}/end-otp/verify': {
      post: {
        tags: ['Bookings'],
        summary: 'Verify Single Common End OTP (Allowed ONLY when ALL items are completed -> Triggers Cashback & Points)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['otp'],
                properties: { otp: { type: 'string', example: '5678' } },
              },
            },
          },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/bookings/{id}/cancel': {
      post: {
        tags: ['Bookings'],
        summary: 'Cancel Booking with Dynamic Fee Calculation (>6h free, 2-6h fee, <2h fee, waived if delayed/unassigned)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  reason: { type: 'string', example: 'Change of schedule' },
                  isDelayed: { type: 'boolean', default: false },
                },
              },
            },
          },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/bookings/{id}/assign': {
      post: {
        tags: ['Bookings'],
        summary: 'Admin Manual Beautician Assignment / Reassignment',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['assignments'],
                properties: {
                  assignments: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['beauticianId', 'beauticianName', 'assignedItemIds'],
                      properties: {
                        beauticianId: { type: 'string' },
                        beauticianName: { type: 'string' },
                        assignedItemIds: { type: 'array', items: { type: 'string' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
    '/api/v1/bookings/{id}/reschedule': {
      patch: {
        tags: ['Calendar', 'Bookings'],
        summary: 'Reschedule Booking with Conflict Detection & Admin Audit',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['date', 'startTime'],
                properties: {
                  date: { type: 'string', example: '2026-09-15' },
                  startTime: { type: 'string', example: '14:00' },
                  endTime: { type: 'string', example: '15:00' },
                  beauticianId: { type: 'string' },
                  beauticianName: { type: 'string' },
                  reason: { type: 'string', example: 'Customer requested afternoon slot' },
                },
              },
            },
          },
        },
        responses: {
          200: { $ref: '#/components/responses/SuccessEnvelope' },
          409: { description: 'Beautician time conflict' },
        },
      },
    },
    '/api/v1/bookings/{id}/complete': {
      post: {
        tags: ['Calendar', 'Bookings'],
        summary: 'Admin Direct Booking Completion',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { notes: { type: 'string', example: 'Admin completed service' } },
              },
            },
          },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },

    // ------------------------------------------------------------------------
    // CALENDAR SERVICE
    // ------------------------------------------------------------------------
    '/api/v1/calendar': {
      get: {
        tags: ['Calendar'],
        summary: 'Query Schedule Calendar (Month, Week, Day, Agenda with Day-level Counts & Conflict Indicators)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'view', in: 'query', schema: { type: 'string', enum: ['month', 'week', 'day', 'agenda'], default: 'month' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', example: '2026-09-01' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', example: '2026-09-30' } },
          { name: 'date', in: 'query', schema: { type: 'string', example: '2026-09-11' } },
          { name: 'beauticianId', in: 'query', schema: { type: 'string' } },
          { name: 'serviceId', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'locationId', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 500 } },
        ],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/calendar/today': {
      get: {
        tags: ['Calendar'],
        summary: "Get Today's Appointments with Real-time Conflict Indicators (Right Sidebar)",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'date', in: 'query', schema: { type: 'string', example: '2026-09-11' } },
          { name: 'beauticianId', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/calendar/summary': {
      get: {
        tags: ['Calendar'],
        summary: 'Get Calendar KPI Summary & Dynamic Trend Statistics from Database',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'startDate', in: 'query', schema: { type: 'string', example: '2026-09-01' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', example: '2026-09-30' } },
        ],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/calendar/availability': {
      get: {
        tags: ['Calendar'],
        summary: 'Get Beautician Available Time Slots',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'date', in: 'query', required: true, schema: { type: 'string', example: '2026-09-11' } },
          { name: 'beauticianId', in: 'query', schema: { type: 'string' } },
          { name: 'serviceId', in: 'query', schema: { type: 'string' } },
          { name: 'durationMinutes', in: 'query', schema: { type: 'integer', default: 60 } },
        ],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/calendar/conflicts': {
      get: {
        tags: ['Calendar'],
        summary: 'Get Detected Booking Overlaps and Schedule Conflicts',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'startDate', in: 'query', schema: { type: 'string' } },
          { name: 'endDate', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },

    // ------------------------------------------------------------------------
    // CART SERVICE
    // ------------------------------------------------------------------------
    '/api/v1/cart': {
      get: {
        tags: ['Cart'],
        summary: 'Get Current User Cart',
        security: [{ BearerAuth: [] }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      delete: {
        tags: ['Cart'],
        summary: 'Clear Cart',
        security: [{ BearerAuth: [] }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/cart/items': {
      post: {
        tags: ['Cart'],
        summary: 'Add Service or Package to Cart',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['itemType', 'itemId'],
                properties: {
                  itemType: { type: 'string', enum: ['service', 'package'] },
                  itemId: { type: 'string' },
                  quantity: { type: 'integer', default: 1 },
                },
              },
            },
          },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/cart/items/{lineId}': {
      patch: {
        tags: ['Cart'],
        summary: 'Update Cart Item Quantity',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'lineId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['quantity'],
                properties: { quantity: { type: 'integer', example: 2 } },
              },
            },
          },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      delete: {
        tags: ['Cart'],
        summary: 'Remove Item from Cart',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'lineId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/cart/hygiene-kit': {
      patch: {
        tags: ['Cart'],
        summary: 'Toggle Hygiene Kit in Cart',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['enabled'],
                properties: { enabled: { type: 'boolean' } },
              },
            },
          },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },

    // ------------------------------------------------------------------------
    // PAYMENTS
    // ------------------------------------------------------------------------
    '/api/v1/payments/create-order': {
      post: {
        tags: ['Payments'],
        summary: 'Create Razorpay Payment Order',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['bookingId', 'amount'],
                properties: {
                  bookingId: { type: 'string' },
                  amount: { type: 'number', example: 1499 },
                  currency: { type: 'string', default: 'INR' },
                },
              },
            },
          },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/payments/verify': {
      post: {
        tags: ['Payments'],
        summary: 'Verify Razorpay Signature & Complete Payment',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature'],
                properties: {
                  razorpay_order_id: { type: 'string' },
                  razorpay_payment_id: { type: 'string' },
                  razorpay_signature: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/payments/webhook': {
      post: {
        tags: ['Payments'],
        summary: 'Razorpay Automated Webhook Listener',
        responses: { 200: { description: 'Webhook captured' } },
      },
    },

    // ------------------------------------------------------------------------
    // WALLET & LOYALTY
    // ------------------------------------------------------------------------
    '/api/v1/wallet/me': {
      get: {
        tags: ['Wallet & Loyalty'],
        summary: 'Get My Wallet Balance & Loyalty Tier',
        security: [{ BearerAuth: [] }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/wallet/topup/create-order': {
      post: {
        tags: ['Wallet & Loyalty'],
        summary: 'Create Wallet Top-up Razorpay Order',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['amount'],
                properties: { amount: { type: 'number', example: 1000 } },
              },
            },
          },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/wallet/topup/verify': {
      post: {
        tags: ['Wallet & Loyalty'],
        summary: 'Verify Wallet Top-up Payment',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature'],
                properties: {
                  razorpay_order_id: { type: 'string' },
                  razorpay_payment_id: { type: 'string' },
                  razorpay_signature: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/wallet/transactions': {
      get: {
        tags: ['Wallet & Loyalty'],
        summary: 'Get Wallet Transaction History',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/wallet/loyalty-rules': {
      get: {
        tags: ['Wallet & Loyalty'],
        summary: 'Get Loyalty Cashback & Points Rules',
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      put: {
        tags: ['Wallet & Loyalty'],
        summary: 'Update Loyalty Rules (Admin)',
        security: [{ BearerAuth: [] }],
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },

    // ------------------------------------------------------------------------
    // NOTIFICATIONS
    // ------------------------------------------------------------------------
    '/api/v1/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'List User Notifications',
        security: [{ BearerAuth: [] }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/notifications/{id}/read': {
      patch: {
        tags: ['Notifications'],
        summary: 'Mark Notification as Read',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/notifications/send': {
      post: {
        tags: ['Notifications'],
        summary: 'Send Push Notification (Admin)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['userId', 'title', 'body'],
                properties: {
                  userId: { type: 'string' },
                  title: { type: 'string', example: 'Booking Confirmed!' },
                  body: { type: 'string', example: 'Your beautician Pooja is on her way.' },
                },
              },
            },
          },
        },
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },

    // ------------------------------------------------------------------------
    // BANNERS & BLOGS
    // ------------------------------------------------------------------------
    '/api/v1/banners/active': {
      get: {
        tags: ['Banners'],
        summary: 'Get Active Banners for App Homepage',
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/banners': {
      get: {
        tags: ['Banners'],
        summary: 'List All Banners (Admin)',
        security: [{ BearerAuth: [] }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      post: {
        tags: ['Banners'],
        summary: 'Create Banner',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['title'],
                properties: {
                  title: { type: 'string', example: 'Monsoon Special Offer' },
                  linkUrl: { type: 'string' },
                  file: { type: 'string', format: 'binary' },
                },
              },
            },
          },
        },
        responses: { 201: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/blogs/home': {
      get: {
        tags: ['Blogs'],
        summary: 'Get Featured Blogs for Home Feed',
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/blogs': {
      get: {
        tags: ['Blogs'],
        summary: 'List All Public Blogs',
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
      post: {
        tags: ['Blogs'],
        summary: 'Create Blog Post (Admin)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['title', 'content'],
                properties: {
                  title: { type: 'string', example: '10 Essential Skincare Tips' },
                  content: { type: 'string' },
                  file: { type: 'string', format: 'binary' },
                },
              },
            },
          },
        },
        responses: { 201: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
    '/api/v1/blogs/{id}/like': {
      post: {
        tags: ['Blogs'],
        summary: 'Like Blog Post',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { $ref: '#/components/responses/SuccessEnvelope' } },
      },
    },
  },
};
