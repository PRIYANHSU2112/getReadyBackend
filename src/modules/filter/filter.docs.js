import {
  bearerSecurity,
  publicSecurity,
  OBJECT_ID,
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
import {
  FilterDisplayType,
  FilterSelectionType,
} from '../../common/constants/enums.js';
import { DEFAULT_FILTER_SORT } from '../../common/constants/filter.js';

const displayTypes = Object.values(FilterDisplayType);
const selectionTypes = Object.values(FilterSelectionType);

const filterExample = {
  id: '64f0c2a1b4e1c2d3e4f50650',
  name: 'Skin Type',
  slug: 'skin-type',
  description: 'Customer skin type preferences',
  displayType: FilterDisplayType.CHIPS,
  selectionType: FilterSelectionType.MULTIPLE,
  isSearchable: false,
  isRequired: false,
  isActive: true,
  isFeatured: true,
  displayOrder: 1,
  icon: null,
  image: {
    url: 'https://cdn.example.com/filters/skin.jpg',
    publicId: 'filters/skin.jpg',
  },
  imageUrl: 'https://cdn.example.com/filters/skin.jpg',
  color: null,
  scopes: ['services'],
  metadata: {},
  deletedAt: null,
  createdAt: '2026-07-25T10:00:00.000Z',
  updatedAt: '2026-07-25T10:00:00.000Z',
};

const valueExample = {
  id: '64f0c2a1b4e1c2d3e4f50651',
  filterId: '64f0c2a1b4e1c2d3e4f50650',
  label: 'Oily',
  value: 'oily',
  slug: 'oily',
  icon: null,
  image: {
    url: 'https://cdn.example.com/filters/oily.jpg',
    publicId: 'filters/oily.jpg',
  },
  imageUrl: 'https://cdn.example.com/filters/oily.jpg',
  color: null,
  displayOrder: 1,
  isDefault: false,
  isActive: true,
  metadata: {},
  deletedAt: null,
};

const createValueSchema = {
  type: 'object',
  required: ['label', 'value'],
  additionalProperties: false,
  properties: {
    label: { type: 'string', example: 'Oily' },
    value: { type: 'string', example: 'oily' },
    slug: { type: 'string' },
    icon: { type: 'string', nullable: true },
    color: { type: 'string', nullable: true },
    displayOrder: { type: 'integer' },
    isDefault: { type: 'boolean' },
    isActive: { type: 'boolean' },
    metadata: { type: 'object' },
    file: {
      type: 'string',
      format: 'binary',
      description: 'Value image (jpeg/png/webp/gif, max 5MB) — uploaded to S3',
    },
  },
};

const jsonWithoutFile = (schema) => ({
  ...schema,
  properties: Object.fromEntries(
    Object.entries(schema.properties).filter(([key]) => key !== 'file'),
  ),
});

const publicExample = {
  id: filterExample.id,
  name: 'Skin Type',
  slug: 'skin-type',
  displayType: 'chips',
  selectionType: 'multiple',
  isRequired: false,
  displayOrder: 1,
  values: [
    {
      id: valueExample.id,
      label: 'Oily',
      value: 'oily',
      displayOrder: 1,
      isDefault: false,
      icon: null,
    },
  ],
};

const adminOnly = '**Auth:** Bearer JWT + RBAC (`filters.*`). Super Admin bypasses.';

const createFilterSchema = {
  type: 'object',
  required: ['name'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', example: 'Skin Type' },
    slug: { type: 'string', example: 'skin-type' },
    description: { type: 'string', nullable: true },
    displayType: { type: 'string', enum: displayTypes },
    selectionType: { type: 'string', enum: selectionTypes },
    isSearchable: { type: 'boolean' },
    isRequired: { type: 'boolean' },
    isActive: { type: 'boolean' },
    isFeatured: { type: 'boolean' },
    displayOrder: { type: 'integer', minimum: 0 },
    icon: { type: 'string', nullable: true },
    color: { type: 'string', nullable: true },
    scopes: { type: 'array', items: { type: 'string' }, example: ['services'] },
    metadata: { type: 'object' },
    file: {
      type: 'string',
      format: 'binary',
      description: 'Filter image (jpeg/png/webp/gif, max 5MB) — uploaded to S3',
    },
  },
};

export const filterDocs = {
  paths: {
    '/api/v1/filters/public': {
      get: {
        tags: ['Filters'],
        summary: 'List active filters (public, slim)',
        description:
          'No auth. Returns only UI fields for the filter sheet (no image/metadata/audit). Cached ~300s.',
        security: publicSecurity,
        parameters: [
          {
            name: 'scope',
            in: 'query',
            schema: { type: 'string', example: 'services' },
          },
        ],
        responses: {
          ...okResponse(successExample([publicExample])),
          ...withErrors(422, 500),
        },
      },
    },

    '/api/v1/filters/reorder': {
      patch: {
        tags: ['Filters'],
        summary: 'Reorder filter groups',
        description: adminOnly,
        security: bearerSecurity,
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['items'],
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['id', 'displayOrder'],
                  properties: {
                    id: { type: 'string' },
                    displayOrder: { type: 'integer' },
                  },
                },
              },
            },
          },
          { items: [{ id: OBJECT_ID, displayOrder: 0 }] },
        ),
        responses: {
          ...okResponse(successExample({ reordered: true })),
          ...withErrors(401, 403, 422, 500),
        },
      },
    },

    '/api/v1/filters/bulk/status': {
      patch: {
        tags: ['Filters'],
        summary: 'Bulk update filter active status',
        description: adminOnly,
        security: bearerSecurity,
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['ids', 'isActive'],
            properties: {
              ids: { type: 'array', items: { type: 'string' } },
              isActive: { type: 'boolean' },
            },
          },
          { ids: [OBJECT_ID], isActive: false },
        ),
        responses: {
          ...okResponse(successExample({ updated: true })),
          ...withErrors(401, 403, 422, 500),
        },
      },
    },

    '/api/v1/filters/bulk/delete': {
      post: {
        tags: ['Filters'],
        summary: 'Bulk soft-delete filters',
        description: adminOnly,
        security: bearerSecurity,
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['ids'],
            properties: {
              ids: { type: 'array', items: { type: 'string' } },
            },
          },
          { ids: [OBJECT_ID] },
        ),
        responses: {
          ...okResponse(successExample({ deleted: true })),
          ...withErrors(401, 403, 422, 500),
        },
      },
    },

    '/api/v1/filters': {
      get: {
        tags: ['Filters'],
        summary: 'List filters (admin)',
        description: adminOnly,
        security: bearerSecurity,
        parameters: [
          ...pageQueryParams({ page: 1, limit: 10 }),
          {
            name: 'sort',
            in: 'query',
            schema: { type: 'string', default: DEFAULT_FILTER_SORT },
          },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'scope', in: 'query', schema: { type: 'string' } },
          { name: 'isActive', in: 'query', schema: { type: 'boolean' } },
          { name: 'includeDeleted', in: 'query', schema: { type: 'boolean' } },
          { name: 'includeValues', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: {
          ...okResponse(
            successExample([filterExample], { ...paginationMeta, total: 1 }),
          ),
          ...withErrors(401, 403, 422, 500),
        },
      },
      post: {
        tags: ['Filters'],
        summary: 'Create filter group',
        description: `${adminOnly}\n\nSlug auto-generated from name when omitted. Optional multipart \`file\` uploads image to S3.`,
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: createFilterSchema,
            },
            'application/json': {
              schema: {
                ...createFilterSchema,
                properties: Object.fromEntries(
                  Object.entries(createFilterSchema.properties).filter(
                    ([key]) => key !== 'file',
                  ),
                ),
              },
              example: {
                name: 'Skin Type',
                displayType: 'chips',
                selectionType: 'multiple',
                scopes: ['services'],
                displayOrder: 1,
              },
            },
          },
        },
        responses: {
          ...createdResponse(successExample(filterExample)),
          ...withErrors(401, 403, 409, 422, 500),
        },
      },
    },

    '/api/v1/filters/{id}': {
      get: {
        tags: ['Filters'],
        summary: 'Get filter by id',
        description: adminOnly,
        security: bearerSecurity,
        parameters: [
          objectIdParam('id', 'Filter ObjectId'),
          {
            name: 'includeValues',
            in: 'query',
            schema: { type: 'boolean' },
          },
        ],
        responses: {
          ...okResponse(successExample(filterExample)),
          ...withErrors(401, 403, 404, 422, 500),
        },
      },
      patch: {
        tags: ['Filters'],
        summary: 'Update filter group',
        description: `${adminOnly}\n\nJSON or multipart. Optional \`file\` replaces the filter image on S3.`,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Filter ObjectId')],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                minProperties: 1,
                properties: createFilterSchema.properties,
              },
            },
            'application/json': {
              schema: {
                type: 'object',
                minProperties: 1,
                properties: jsonWithoutFile(createFilterSchema).properties,
              },
              example: { name: 'Skin Type', isFeatured: true },
            },
          },
        },
        responses: {
          ...okResponse(successExample(filterExample)),
          ...withErrors(401, 403, 404, 409, 422, 500),
        },
      },
      delete: {
        tags: ['Filters'],
        summary: 'Soft-delete filter group',
        description: `${adminOnly}\n\nAlso soft-deletes child values.`,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Filter ObjectId')],
        responses: {
          ...noContentResponse(),
          ...withErrors(401, 403, 404, 422, 500),
        },
      },
    },

    '/api/v1/filters/{id}/restore': {
      post: {
        tags: ['Filters'],
        summary: 'Restore soft-deleted filter group',
        description: adminOnly,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Filter ObjectId')],
        responses: {
          ...okResponse(successExample(filterExample)),
          ...withErrors(400, 401, 403, 404, 409, 500),
        },
      },
    },

    '/api/v1/filters/{id}/status': {
      patch: {
        tags: ['Filters'],
        summary: 'Set filter active status',
        description: adminOnly,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Filter ObjectId')],
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['isActive'],
            properties: { isActive: { type: 'boolean' } },
          },
          { isActive: false },
        ),
        responses: {
          ...okResponse(successExample({ ...filterExample, isActive: false })),
          ...withErrors(401, 403, 404, 422, 500),
        },
      },
    },

    '/api/v1/filters/{filterId}/values': {
      get: {
        tags: ['Filters'],
        summary: 'List filter values',
        description: adminOnly,
        security: bearerSecurity,
        parameters: [
          objectIdParam('filterId', 'Filter ObjectId'),
          ...pageQueryParams({ page: 1, limit: 20 }),
        ],
        responses: {
          ...okResponse(
            successExample([valueExample], { ...paginationMeta, total: 1 }),
          ),
          ...withErrors(401, 403, 404, 422, 500),
        },
      },
      post: {
        tags: ['Filters'],
        summary: 'Create filter value',
        description: `${adminOnly}\n\nOptional multipart \`file\` uploads value image to S3.`,
        security: bearerSecurity,
        parameters: [objectIdParam('filterId', 'Filter ObjectId')],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: createValueSchema,
            },
            'application/json': {
              schema: jsonWithoutFile(createValueSchema),
              example: { label: 'Oily', value: 'oily', displayOrder: 1 },
            },
          },
        },
        responses: {
          ...createdResponse(successExample(valueExample)),
          ...withErrors(401, 403, 404, 409, 422, 500),
        },
      },
    },

    '/api/v1/filters/{filterId}/values/reorder': {
      patch: {
        tags: ['Filters'],
        summary: 'Reorder filter values',
        description: adminOnly,
        security: bearerSecurity,
        parameters: [objectIdParam('filterId', 'Filter ObjectId')],
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['items'],
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['id', 'displayOrder'],
                  properties: {
                    id: { type: 'string' },
                    displayOrder: { type: 'integer' },
                  },
                },
              },
            },
          },
          { items: [{ id: OBJECT_ID, displayOrder: 0 }] },
        ),
        responses: {
          ...okResponse(successExample({ reordered: true })),
          ...withErrors(401, 403, 404, 422, 500),
        },
      },
    },

    '/api/v1/filters/{filterId}/values/{valueId}': {
      patch: {
        tags: ['Filters'],
        summary: 'Update filter value',
        description: `${adminOnly}\n\nJSON or multipart. Optional \`file\` replaces the value image.`,
        security: bearerSecurity,
        parameters: [
          objectIdParam('filterId', 'Filter ObjectId'),
          objectIdParam('valueId', 'Filter value ObjectId'),
        ],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                minProperties: 1,
                properties: createValueSchema.properties,
              },
            },
            'application/json': {
              schema: {
                type: 'object',
                minProperties: 1,
                properties: jsonWithoutFile(createValueSchema).properties,
              },
              example: { label: 'Oily', isDefault: true },
            },
          },
        },
        responses: {
          ...okResponse(successExample(valueExample)),
          ...withErrors(401, 403, 404, 409, 422, 500),
        },
      },
      delete: {
        tags: ['Filters'],
        summary: 'Soft-delete filter value',
        description: adminOnly,
        security: bearerSecurity,
        parameters: [
          objectIdParam('filterId', 'Filter ObjectId'),
          objectIdParam('valueId', 'Filter value ObjectId'),
        ],
        responses: {
          ...noContentResponse(),
          ...withErrors(401, 403, 404, 422, 500),
        },
      },
    },

    '/api/v1/filters/{filterId}/values/{valueId}/restore': {
      post: {
        tags: ['Filters'],
        summary: 'Restore soft-deleted filter value',
        description: adminOnly,
        security: bearerSecurity,
        parameters: [
          objectIdParam('filterId', 'Filter ObjectId'),
          objectIdParam('valueId', 'Filter value ObjectId'),
        ],
        responses: {
          ...okResponse(successExample(valueExample)),
          ...withErrors(400, 401, 403, 404, 409, 500),
        },
      },
    },
  },
};
