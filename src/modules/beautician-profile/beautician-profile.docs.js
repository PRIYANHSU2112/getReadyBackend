import {
  bearerSecurity,
  OBJECT_ID,
  jsonBody,
  okResponse,
  createdResponse,
  noContentResponse,
  withErrors,
  successExample,
  objectIdParam,
  pageQueryParams,
} from '../../core/swagger/swagger.common.js';

const profileExample = {
  id: '64f0c2a1b4e1c2d3e4f50880',
  userId: {
    id: '64f0c2a1b4e1c2d3e4f50111',
    name: 'Aisha Sheikh',
    email: 'aisha@stylist.com',
    phone: '+919876543210',
    profileImage: null,
    gender: 'FEMALE',
  },
  languages: ['Hindi', 'English', 'Marathi'],
  bio: 'Experienced bridal hair stylist & makeup artist with over 6 years of expertise.',
  skills: [
    {
      id: '64f0c2a1b4e1c2d3e4f50770',
      name: 'Hair Coloring',
      icon: null,
    },
  ],
  yearsOfExperience: 6,
  preferredHours: {
    startTime: '09:00',
    endTime: '18:00',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  },
  ratingAvg: 4.8,
  ratingCount: 124,
  kyc: {
    status: 'VERIFIED',
    rejectionReason: null,
    verifiedBy: '64f0c2a1b4e1c2d3e4f50601',
    verifiedAt: '2026-07-27T10:00:00.000Z',
    selfieImage: {
      url: 'https://cdn.example.com/uploads/1722421200000_selfie.jpg',
      publicId: 'uploads/1722421200000_selfie.jpg',
    },
    idCardFront: {
      url: 'https://cdn.example.com/uploads/1722421200000_front.jpg',
      publicId: 'uploads/1722421200000_front.jpg',
    },
    idCardBack: {
      url: 'https://cdn.example.com/uploads/1722421200000_back.jpg',
      publicId: 'uploads/1722421200000_back.jpg',
    },
  },
  profileStatus: 'APPROVED',
  rejectionReason: null,
  workHistory: [
    {
      id: '64f0c2a1b4e1c2d3e4f50990',
      salonName: 'Elite Salon & Spa',
      role: 'Senior Hair Stylist',
      startDate: '2020-01-01T00:00:00.000Z',
      endDate: '2023-12-31T00:00:00.000Z',
      isCurrent: false,
    },
  ],
  certificates: [
    {
      id: '64f0c2a1b4e1c2d3e4f50aaa',
      title: 'Bridal Certification',
      issueDate: '2024-07-26T00:00:00.000Z',
      certificateImage: {
        url: 'https://cdn.example.com/uploads/1722421200000_cert.jpg',
        publicId: 'uploads/1722421200000_cert.jpg',
      },
      status: 'VERIFIED',
    },
  ],
};

const workHistoryExample = {
  id: '64f0c2a1b4e1c2d3e4f50990',
  salonName: 'Elite Salon & Spa',
  role: 'Senior Hair Stylist',
  startDate: '2020-01-01T00:00:00.000Z',
  endDate: '2023-12-31T00:00:00.000Z',
  isCurrent: false,
};

const certificateExample = {
  id: '64f0c2a1b4e1c2d3e4f50aaa',
  title: 'Bridal Certification',
  issueDate: '2024-07-26T00:00:00.000Z',
  certificateImage: {
    url: 'https://cdn.example.com/uploads/1722421200000_cert.jpg',
    publicId: 'uploads/1722421200000_cert.jpg',
  },
  status: 'VERIFIED',
};

export const beauticianProfileDocs = {
  paths: {
    '/api/v1/beautician-profiles': {
      post: {
        tags: ['Beautician Profile'],
        summary: 'Create beautician profile (Initial Step 1)',
        description: 'Create initial profile after registering as beautician.',
        security: bearerSecurity,
        requestBody: jsonBody({
          type: 'object',
          properties: {
            languages: { type: 'array', items: { type: 'string', example: 'Hindi' } },
            bio: { type: 'string', example: 'Bridal specialist' },
            preferredHours: {
              type: 'object',
              properties: {
                startTime: { type: 'string', example: '09:00' },
                endTime: { type: 'string', example: '18:00' },
                days: { type: 'array', items: { type: 'string', example: 'monday' } },
              },
            },
          },
        }),
        responses: {
          201: createdResponse(successExample(profileExample)),
          ...withErrors(400, 401, 409),
        },
      },
      get: {
        tags: ['Beautician Profile'],
        summary: 'List beautician profiles (Admin)',
        security: bearerSecurity,
        parameters: [
          ...pageQueryParams(),
          {
            name: 'profileStatus',
            in: 'query',
            schema: { type: 'string', enum: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'] },
          },
          {
            name: 'kycStatus',
            in: 'query',
            schema: { type: 'string', enum: ['PENDING', 'VERIFIED', 'REJECTED'] },
          },
        ],
        responses: {
          200: okResponse('Profiles list', successExample([profileExample])),
          ...withErrors(401, 403),
        },
      },
    },
    '/api/v1/beautician-profiles/me': {
      get: {
        tags: ['Beautician Profile'],
        summary: 'Get my beautician profile',
        description: 'Fetch profile details of logged-in beautician with skills, work history, certificates, and structured KYC document object.',
        security: bearerSecurity,
        responses: {
          200: okResponse('My beautician profile', successExample(profileExample)),
          ...withErrors(401, 404),
        },
      },
      patch: {
        tags: ['Beautician Profile'],
        summary: 'Update my beautician profile',
        security: bearerSecurity,
        requestBody: jsonBody({
          type: 'object',
          properties: {
            languages: { type: 'array', items: { type: 'string' } },
            bio: { type: 'string' },
            skills: { type: 'array', items: { type: 'string', example: OBJECT_ID } },
            yearsOfExperience: { type: 'number', example: 6 },
            preferredHours: {
              type: 'object',
              properties: {
                startTime: { type: 'string', example: '09:00' },
                endTime: { type: 'string', example: '18:00' },
                days: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        }),
        responses: {
          200: okResponse('Updated profile', successExample(profileExample)),
          ...withErrors(400, 401, 404),
        },
      },
    },
    '/api/v1/beautician-profiles/me/selfie': {
      post: {
        tags: ['Beautician Profile'],
        summary: 'Upload KYC images: selfieImage, idCardFront, idCardBack (S3 Upload)',
        description: 'Upload KYC verification images to AWS S3 using multipart/form-data with fields `selfieImage`, `idCardFront`, and `idCardBack`. Stores them inside the embedded `kyc` object.',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  selfieImage: {
                    type: 'string',
                    format: 'binary',
                    description: 'Beautician selfie image / face photo',
                  },
                  idCardFront: {
                    type: 'string',
                    format: 'binary',
                    description: 'ID card front image (e.g. Aadhar / Passport / License Front)',
                  },
                  idCardBack: {
                    type: 'string',
                    format: 'binary',
                    description: 'ID card back image (e.g. Aadhar / ID Back)',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: okResponse('KYC images uploaded to S3', successExample(profileExample)),
          ...withErrors(400, 401, 404),
        },
      },
    },
    '/api/v1/beautician-profiles/me/submit': {
      post: {
        tags: ['Beautician Profile'],
        summary: 'Submit profile for admin verification',
        security: bearerSecurity,
        responses: {
          200: okResponse('Submitted for review', successExample({ ...profileExample, profileStatus: 'UNDER_REVIEW' })),
          ...withErrors(400, 401, 404),
        },
      },
    },
    '/api/v1/beautician-profiles/me/work-history': {
      get: {
        tags: ['Beautician Work History'],
        summary: 'Get my work history entries',
        security: bearerSecurity,
        responses: {
          200: okResponse('Work history list', successExample([workHistoryExample])),
          ...withErrors(401),
        },
      },
      post: {
        tags: ['Beautician Work History'],
        summary: 'Add work history entry',
        security: bearerSecurity,
        requestBody: jsonBody({
          type: 'object',
          required: ['salonName', 'startDate'],
          properties: {
            salonName: { type: 'string', example: 'Elite Salon & Spa' },
            role: { type: 'string', example: 'Senior Hair Stylist' },
            startDate: { type: 'string', format: 'date', example: '2020-01-01' },
            endDate: { type: 'string', format: 'date', example: '2023-12-31' },
            isCurrent: { type: 'boolean', example: false },
          },
        }),
        responses: {
          201: createdResponse(successExample(workHistoryExample)),
          ...withErrors(400, 401),
        },
      },
    },
    '/api/v1/beautician-profiles/me/work-history/{id}': {
      patch: {
        tags: ['Beautician Work History'],
        summary: 'Update work history entry',
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Work History Entry ID')],
        requestBody: jsonBody({
          type: 'object',
          properties: {
            salonName: { type: 'string' },
            role: { type: 'string' },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            isCurrent: { type: 'boolean' },
          },
        }),
        responses: {
          200: okResponse('Entry updated', successExample(workHistoryExample)),
          ...withErrors(400, 401, 404),
        },
      },
      delete: {
        tags: ['Beautician Work History'],
        summary: 'Delete work history entry',
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Work History Entry ID')],
        responses: {
          204: noContentResponse(),
          ...withErrors(401, 404),
        },
      },
    },
    '/api/v1/beautician-profiles/me/certificates': {
      get: {
        tags: ['Beautician Certificates'],
        summary: 'Get my uploaded certificates',
        security: bearerSecurity,
        responses: {
          200: okResponse('Certificates list', successExample([certificateExample])),
          ...withErrors(401),
        },
      },
      post: {
        tags: ['Beautician Certificates'],
        summary: 'Upload new certificate (S3 Upload)',
        description: 'Upload certificate document with optional image file to S3. Accepts JSON or multipart/form-data.',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['title'],
                properties: {
                  title: { type: 'string', example: 'Bridal Certification' },
                  issueDate: { type: 'string', format: 'date', example: '2024-07-26' },
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'Certificate image file (JPEG/PNG/PDF, max 5MB)',
                  },
                },
              },
            },
            'application/json': {
              schema: {
                type: 'object',
                required: ['title'],
                properties: {
                  title: { type: 'string', example: 'Bridal Certification' },
                  issueDate: { type: 'string', format: 'date', example: '2024-07-26' },
                },
              },
            },
          },
        },
        responses: {
          201: createdResponse(successExample(certificateExample)),
          ...withErrors(400, 401),
        },
      },
    },
    '/api/v1/beautician-profiles/me/certificates/{id}': {
      patch: {
        tags: ['Beautician Certificates'],
        summary: 'Update certificate details / replace S3 image',
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Certificate ID')],
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  issueDate: { type: 'string' },
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'New certificate image file to replace on S3',
                  },
                },
              },
            },
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  issueDate: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: okResponse('Certificate updated', successExample(certificateExample)),
          ...withErrors(400, 401, 404),
        },
      },
      delete: {
        tags: ['Beautician Certificates'],
        summary: 'Delete certificate and remove S3 image',
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Certificate ID')],
        responses: {
          204: noContentResponse(),
          ...withErrors(401, 404),
        },
      },
    },
    '/api/v1/beautician-profiles/{id}': {
      get: {
        tags: ['Beautician Profile'],
        summary: 'Get beautician profile by ID (Admin)',
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Profile ID')],
        responses: {
          200: okResponse('Profile details', successExample(profileExample)),
          ...withErrors(404),
        },
      },
    },
    '/api/v1/beautician-profiles/{id}/review': {
      patch: {
        tags: ['Beautician Profile'],
        summary: 'Approve or reject beautician profile (Admin)',
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Profile ID')],
        requestBody: jsonBody({
          type: 'object',
          required: ['profileStatus'],
          properties: {
            profileStatus: { type: 'string', enum: ['APPROVED', 'REJECTED', 'SUSPENDED'] },
            rejectionReason: { type: 'string' },
          },
        }),
        responses: {
          200: okResponse('Profile reviewed', successExample(profileExample)),
          ...withErrors(400, 404),
        },
      },
    },
    '/api/v1/beautician-profiles/{id}/kyc-review': {
      patch: {
        tags: ['Beautician Profile'],
        summary: 'Verify or reject KYC (Admin)',
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Profile ID')],
        requestBody: jsonBody({
          type: 'object',
          required: ['kycStatus'],
          properties: {
            kycStatus: { type: 'string', enum: ['VERIFIED', 'REJECTED'] },
            kycRejectionReason: { type: 'string' },
          },
        }),
        responses: {
          200: okResponse('KYC reviewed', successExample(profileExample)),
          ...withErrors(400, 404),
        },
      },
    },
    '/api/v1/beautician-profiles/certificates/{id}/review': {
      patch: {
        tags: ['Beautician Certificates'],
        summary: 'Verify or reject certificate (Admin)',
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Certificate ID')],
        requestBody: jsonBody({
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['VERIFIED', 'REJECTED'] },
            rejectionReason: { type: 'string' },
          },
        }),
        responses: {
          200: okResponse('Certificate reviewed', successExample(certificateExample)),
          ...withErrors(400, 404),
        },
      },
    },
  },
};
