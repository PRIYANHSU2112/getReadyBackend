import {
  bearerSecurity,
  jsonBody,
  okResponse,
  noContentResponse,
  withErrors,
  successExample,
  objectIdParam,
  pageQueryParams,
} from '../../core/swagger/swagger.common.js';

const bankDetailExample = {
  id: '64f0c2a1b4e1c2d3e4f50bbb',
  userId: '64f0c2a1b4e1c2d3e4f50111',
  beauticianProfileId: '64f0c2a1b4e1c2d3e4f50880',
  accountHolderName: 'Aisha Sheikh',
  accountNumber: '987654523467',
  maskedAccountNumber: '****3467',
  ifscCode: 'PUNB0647400',
  bankName: 'Punjab National Bank',
  branchName: 'Main Branch',
  passbookImage: {
    url: 'https://cdn.example.com/uploads/1722421200000_passbook.jpg',
    publicId: 'uploads/1722421200000_passbook.jpg',
  },
  upiId: 'aisha@oksbi',
  status: 'PENDING',
};

export const bankDetailDocs = {
  paths: {
    '/api/v1/bank-details/me': {
      get: {
        tags: ['Bank Details'],
        summary: 'Get my payout / bank details',
        security: bearerSecurity,
        responses: {
          200: okResponse('My bank details', successExample(bankDetailExample)),
          ...withErrors(401, 404),
        },
      },
      put: {
        tags: ['Bank Details'],
        summary: 'Create or update payout bank details (S3 Passbook Upload)',
        description: 'Upsert bank details. Supports uploading passbook image file to S3 via multipart/form-data. Resets status to PENDING on update.',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['accountHolderName', 'accountNumber', 'ifscCode'],
                properties: {
                  accountHolderName: { type: 'string', example: 'Aisha Sheikh' },
                  accountNumber: { type: 'string', example: '987654523467' },
                  ifscCode: { type: 'string', example: 'PUNB0647400' },
                  bankName: { type: 'string', example: 'Punjab National Bank' },
                  branchName: { type: 'string', example: 'Main Branch' },
                  upiId: { type: 'string', example: 'aisha@oksbi' },
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'Passbook or cancelled cheque image file to upload to S3',
                  },
                },
              },
            },
            'application/json': {
              schema: {
                type: 'object',
                required: ['accountHolderName', 'accountNumber', 'ifscCode'],
                properties: {
                  accountHolderName: { type: 'string', example: 'Aisha Sheikh' },
                  accountNumber: { type: 'string', example: '987654523467' },
                  ifscCode: { type: 'string', example: 'PUNB0647400' },
                  bankName: { type: 'string', example: 'Punjab National Bank' },
                  branchName: { type: 'string', example: 'Main Branch' },
                  upiId: { type: 'string', example: 'aisha@oksbi' },
                },
              },
            },
          },
        },
        responses: {
          200: okResponse('Bank details updated', successExample(bankDetailExample)),
          ...withErrors(400, 401, 404),
        },
      },
      delete: {
        tags: ['Bank Details'],
        summary: 'Delete my bank details and S3 passbook image',
        security: bearerSecurity,
        responses: {
          204: noContentResponse(),
          ...withErrors(401, 404),
        },
      },
    },
    '/api/v1/bank-details': {
      get: {
        tags: ['Bank Details'],
        summary: 'List all bank details (Admin)',
        security: bearerSecurity,
        parameters: [
          ...pageQueryParams(),
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['PENDING', 'VERIFIED', 'REJECTED'] },
          },
        ],
        responses: {
          200: okResponse('Bank details list', successExample([bankDetailExample])),
        },
      },
    },
    '/api/v1/bank-details/{id}/review': {
      patch: {
        tags: ['Bank Details'],
        summary: 'Verify or reject bank details (Admin)',
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Bank Detail ID')],
        requestBody: jsonBody({
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['VERIFIED', 'REJECTED'] },
            rejectionReason: { type: 'string' },
          },
        }),
        responses: {
          200: okResponse('Review submitted', successExample({ ...bankDetailExample, status: 'VERIFIED' })),
          ...withErrors(400, 404),
        },
      },
    },
  },
};
