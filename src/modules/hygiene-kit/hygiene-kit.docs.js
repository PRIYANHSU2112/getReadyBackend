import {
  bearerSecurity,
  publicSecurity,
  OBJECT_ID,
  paginationMeta,
  okResponse,
  createdResponse,
  noContentResponse,
  withErrors,
  successExample,
  objectIdParam,
  pageQueryParams,
} from '../../core/swagger/swagger.common.js';
import { HygieneKitStatus } from '../../common/constants/enums.js';
import {
  HYGIENE_KIT_SORT_FIELDS,
} from '../../common/constants/hygiene-kit.js';

const statusValues = Object.values(HygieneKitStatus);
const sortEnum = HYGIENE_KIT_SORT_FIELDS.flatMap((field) => [field, `-${field}`]);

const hygieneKitExample = {
  id: '64f0c2a1b4e1c2d3e4f50650',
  title: 'Standard Safety & Hygiene Kit',
  code: 'DEFAULT_HYGIENE_KIT',
  price: 49,
  description: 'Single-use sealed hygiene and sanitization kit opened fresh in front of customer.',
  includedItems: [
    {
      name: 'Disposable Bedsheet',
      quantity: 1,
      icon: 'bedsheet',
      description: 'Single-use sterile sheet',
    },
    {
      name: 'Sanitized Disinfection Gloves & Face Mask',
      quantity: 1,
      icon: 'mask',
      description: 'Nitrile gloves and 3-ply mask',
    },
    {
      name: 'Alcohol Disinfection Wipes',
      quantity: 2,
      icon: 'wipe',
      description: '70% Isopropyl alcohol wipes',
    },
    {
      name: 'Bio-hazard Disposable Trash Bag',
      quantity: 1,
      icon: 'trash',
      description: 'Clean disposal bag',
    },
  ],
  image: {
    url: 'https://cdn.example.com/hygiene-kits/standard-kit.jpg',
    publicId: 'hygiene-kits/standard-kit.jpg',
  },
  imageUrl: 'https://cdn.example.com/hygiene-kits/standard-kit.jpg',
  isDefault: true,
  isRequired: true,
  minQuantity: 1,
  maxQuantity: 10,
  status: HygieneKitStatus.ACTIVE,
  sortOrder: 0,
  deletedAt: null,
  createdAt: '2026-08-20T05:00:00.000Z',
  updatedAt: '2026-08-20T05:00:00.000Z',
};

const kitSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', example: OBJECT_ID },
    title: { type: 'string', example: 'Standard Safety & Hygiene Kit' },
    code: { type: 'string', example: 'DEFAULT_HYGIENE_KIT' },
    price: { type: 'number', example: 49 },
    description: { type: 'string', example: 'Sanitized single-use hygiene kit' },
    includedItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'Disposable Bedsheet' },
          quantity: { type: 'number', example: 1 },
          icon: { type: 'string', nullable: true, example: 'bedsheet' },
          description: { type: 'string', nullable: true, example: 'Single-use sterile sheet' },
        },
      },
    },
    image: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        publicId: { type: 'string', nullable: true },
      },
    },
    imageUrl: { type: 'string', nullable: true },
    isDefault: { type: 'boolean', example: true },
    isRequired: { type: 'boolean', example: true },
    minQuantity: { type: 'number', example: 1 },
    maxQuantity: { type: 'number', example: 10 },
    status: { type: 'string', enum: statusValues, example: HygieneKitStatus.ACTIVE },
    sortOrder: { type: 'number', example: 0 },
    deletedAt: { type: 'string', nullable: true },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
};

export const hygieneKitDocs = {
  paths: {
    '/api/v1/hygiene-kits/default': {

    get: {
      tags: ['Hygiene Kits'],
      summary: 'Get active default hygiene kit (Cart & Info Modal)',
      description: 'Returns the active default mandatory ₹49 hygiene kit with included items and image.',
      security: publicSecurity,
      responses: withErrors({
        200: okResponse('Default hygiene kit retrieved', kitSchema, hygieneKitExample),
      }),
    },
  },
    '/api/v1/hygiene-kits/active': {
      get: {
        tags: ['Hygiene Kits'],
        summary: 'List active hygiene kits (Public)',
        description: 'Paginated list of active hygiene kits for client selection or information.',
        security: publicSecurity,
        parameters: pageQueryParams(sortEnum, 'sortOrder'),
        responses: withErrors({
          200: okResponse(
            'Active hygiene kits retrieved',
            {
              type: 'object',
              properties: {
                items: { type: 'array', items: kitSchema },
                meta: paginationMeta,
              },
            },
            {
              items: [hygieneKitExample],
              meta: successExample({ page: 1, limit: 20, total: 1, totalPages: 1 }),
            },
          ),
        }),
      },
    },
    '/api/v1/hygiene-kits': {
      get: {
        tags: ['Hygiene Kits'],
        summary: 'Admin list all hygiene kits',
        description: 'Full list with pagination, search, status, and isDefault filter.',
        security: bearerSecurity,
        parameters: [
          ...pageQueryParams(sortEnum, 'sortOrder'),
          { name: 'status', in: 'query', schema: { type: 'string', enum: statusValues } },
          { name: 'isDefault', in: 'query', schema: { type: 'boolean' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: withErrors({
          200: okResponse(
            'Hygiene kits retrieved',
            {
              type: 'object',
              properties: {
                items: { type: 'array', items: kitSchema },
                meta: paginationMeta,
              },
            },
            {
              items: [hygieneKitExample],
              meta: successExample({ page: 1, limit: 10, total: 1, totalPages: 1 }),
            },
          ),
        }),
      },
      post: {
        tags: ['Hygiene Kits'],
        summary: 'Create hygiene kit (Admin)',
        description: 'Create a new hygiene kit with optional image file and included items list.',
        security: bearerSecurity,
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['title'],
                properties: {
                  title: { type: 'string', example: 'Standard Safety & Hygiene Kit' },
                  code: { type: 'string', example: 'DEFAULT_HYGIENE_KIT' },
                  price: { type: 'number', example: 49 },
                  description: { type: 'string' },
                  includedItems: {
                    type: 'string',
                    description: 'JSON array string or comma separated items',
                    example: '[{"name":"Disposable Bedsheet","quantity":1}]',
                  },
                  isDefault: { type: 'boolean', example: true },
                  isRequired: { type: 'boolean', example: true },
                  minQuantity: { type: 'number', example: 1 },
                  maxQuantity: { type: 'number', example: 10 },
                  status: { type: 'string', enum: statusValues, example: 'ACTIVE' },
                  sortOrder: { type: 'number', example: 0 },
                  file: { type: 'string', format: 'binary' },
                },
              },
            },
          },
        },
        responses: withErrors({
          201: createdResponse('Hygiene kit created', kitSchema, hygieneKitExample),
        }),
      },
    },
    '/api/v1/hygiene-kits/{id}': {
      get: {
        tags: ['Hygiene Kits'],
        summary: 'Get hygiene kit by ID',
        security: publicSecurity,
        parameters: [objectIdParam('id', 'Hygiene kit ID')],
        responses: withErrors({
          200: okResponse('Hygiene kit retrieved', kitSchema, hygieneKitExample),
        }),
      },
      patch: {
        tags: ['Hygiene Kits'],
        summary: 'Update hygiene kit (Admin)',
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Hygiene kit ID')],
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  code: { type: 'string' },
                  price: { type: 'number' },
                  description: { type: 'string' },
                  includedItems: { type: 'string' },
                  isDefault: { type: 'boolean' },
                  isRequired: { type: 'boolean' },
                  status: { type: 'string', enum: statusValues },
                  sortOrder: { type: 'number' },
                  file: { type: 'string', format: 'binary' },
                },
              },
            },
          },
        },
        responses: withErrors({
          200: okResponse('Hygiene kit updated', kitSchema, hygieneKitExample),
        }),
      },
      delete: {
        tags: ['Hygiene Kits'],
        summary: 'Delete hygiene kit (Soft delete)',
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Hygiene kit ID')],
        responses: withErrors({
          204: noContentResponse('Hygiene kit deleted'),
        }),
      },
    },
    '/api/v1/hygiene-kits/{id}/default': {
      patch: {
        tags: ['Hygiene Kits'],
        summary: 'Set hygiene kit as system default (Admin)',
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Hygiene kit ID')],
        responses: withErrors({
          200: okResponse('Hygiene kit set as default', kitSchema, hygieneKitExample),
        }),
      },
    },
    '/api/v1/hygiene-kits/{id}/restore': {
      post: {
        tags: ['Hygiene Kits'],
        summary: 'Restore soft-deleted hygiene kit (Admin)',
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Hygiene kit ID')],
        responses: withErrors({
          200: okResponse('Hygiene kit restored', kitSchema, hygieneKitExample),
        }),
      },
    },
  },
};

