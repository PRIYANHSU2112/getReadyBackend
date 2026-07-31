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

const categoryExample = {
  id: '64f0c2a1b4e1c2d3e4f50660',
  name: 'Hair',
  slug: 'hair',
  description: 'Haircut, coloring, and styling services',
  image: {
    url: 'https://cdn.example.com/categories/hair.jpg',
    publicId: 'categories/hair.jpg',
  },
  icon: null,
  color: '#E8A0A0',
  displayOrder: 1,
  isActive: true,
  isFeatured: true,
  defaultPriceRange: { min: 299, max: 2499 },
  metadata: {},
  deletedAt: null,
  createdAt: '2026-07-27T10:00:00.000Z',
  updatedAt: '2026-07-27T10:00:00.000Z',
};

const publicExample = {
  id: categoryExample.id,
  name: 'Hair',
  slug: 'hair',
  description: 'Haircut, coloring, and styling services',
  image: categoryExample.image,
  icon: null,
  color: '#E8A0A0',
  displayOrder: 1,
  isFeatured: true,
  defaultPriceRange: { min: 299, max: 2499 },
};

const audiencePublic =
  '**Audience:** Public (Customer / anyone) — **no auth**.\n\n' +
  'Not for Admin or Beautician CMS use; use staff list/get for that.';

const audienceAdminBeautician =
  '**Audience:** Admin **and** Beautician (read-only).\n\n' +
  '**Auth:** Bearer JWT + permission `categories.read`.\n' +
  '**Beautician:** can list/get only — cannot create, update, delete, reorder, or bulk.\n' +
  '**Admin / Super Admin:** full access (Super Admin bypasses RBAC).';

const audienceAdminOnly =
  '**Audience:** Admin only (not Beautician).\n\n' +
  '**Auth:** Bearer JWT + permission `categories.create` / `categories.update` / `categories.delete` as required.\n' +
  '**Beautician:** forbidden (403) — defaults include only `categories.read`.\n' +
  '**Super Admin:** bypasses RBAC.';

const createCategorySchema = {
  type: 'object',
  required: ['name'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', example: 'Hair' },
    slug: { type: 'string', example: 'hair' },
    description: { type: 'string', nullable: true },
    icon: { type: 'string', nullable: true },
    color: { type: 'string', nullable: true },
    displayOrder: { type: 'integer', minimum: 0 },
    isActive: { type: 'boolean' },
    isFeatured: { type: 'boolean' },
    defaultPriceRange: {
      type: 'object',
      properties: {
        min: { type: 'number', nullable: true },
        max: { type: 'number', nullable: true },
      },
    },
    metadata: { type: 'object' },
    file: {
      type: 'string',
      format: 'binary',
      description: 'Category image (jpeg/png/webp/gif, max 5MB) — uploaded to S3',
    },
  },
};

const jsonWithoutFile = (schema) => ({
  ...schema,
  properties: Object.fromEntries(
    Object.entries(schema.properties).filter(([key]) => key !== 'file'),
  ),
});

export const categoryDocs = {
  paths: {
    '/api/v1/categories/public': {
      get: {
        tags: ['Categories'],
        summary: '[Public] List active categories (slim)',
        description:
          `${audiencePublic}\n\nHome/booking tiles. Cached ~300s (L1 + Redis). Optional \`featured=true\`.`,
        security: publicSecurity,
        parameters: [
          {
            name: 'featured',
            in: 'query',
            schema: { type: 'boolean' },
          },
        ],
        responses: {
          ...okResponse(successExample([publicExample])),
          ...withErrors(422, 500),
        },
      },
    },

    '/api/v1/categories/public/{slug}': {
      get: {
        tags: ['Categories'],
        summary: '[Public] Get active category by slug (slim)',
        description: `${audiencePublic}\n\nCached ~300s.`,
        security: publicSecurity,
        parameters: [
          {
            name: 'slug',
            in: 'path',
            required: true,
            schema: { type: 'string', example: 'hair' },
          },
        ],
        responses: {
          ...okResponse(successExample(publicExample)),
          ...withErrors(404, 422, 500),
        },
      },
    },

    '/api/v1/categories/reorder': {
      patch: {
        tags: ['Categories'],
        summary: '[Admin only] Reorder categories',
        description: `${audienceAdminOnly}\n\nRequires \`categories.update\`.`,
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

    '/api/v1/categories/bulk/status': {
      patch: {
        tags: ['Categories'],
        summary: '[Admin only] Bulk update category active status',
        description: `${audienceAdminOnly}\n\nRequires \`categories.update\`.`,
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

    '/api/v1/categories/bulk/delete': {
      post: {
        tags: ['Categories'],
        summary: '[Admin only] Bulk soft-delete categories',
        description: `${audienceAdminOnly}\n\nRequires \`categories.delete\`.`,
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

    '/api/v1/categories': {
      get: {
        tags: ['Categories'],
        summary: '[Admin + Beautician] List categories (paginated)',
        description: `${audienceAdminBeautician}\n\nFull CMS fields (includes metadata/audit). Not cached.`,
        security: bearerSecurity,
        parameters: [
          ...pageQueryParams({ page: 1, limit: 10 }),
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'isActive', in: 'query', schema: { type: 'boolean' } },
          { name: 'isFeatured', in: 'query', schema: { type: 'boolean' } },
          { name: 'includeDeleted', in: 'query', schema: { type: 'boolean' } },
          {
            name: 'sort',
            in: 'query',
            schema: { type: 'string', example: 'displayOrder' },
          },
        ],
        responses: {
          ...okResponse(
            successExample([categoryExample], { ...paginationMeta, total: 1 }),
          ),
          ...withErrors(401, 403, 422, 500),
        },
      },
      post: {
        tags: ['Categories'],
        summary: '[Admin only] Create category',
        description: `${audienceAdminOnly}\n\nRequires \`categories.create\`. Slug auto-generated from name when omitted. Optional multipart \`file\` uploads image to S3.`,
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: createCategorySchema,
            },
            'application/json': {
              schema: jsonWithoutFile(createCategorySchema),
              example: {
                name: 'Hair',
                isFeatured: true,
                defaultPriceRange: { min: 299, max: 2499 },
              },
            },
          },
        },
        responses: {
          ...createdResponse(successExample(categoryExample)),
          ...withErrors(401, 403, 409, 422, 500),
        },
      },
    },

    '/api/v1/categories/{id}': {
      get: {
        tags: ['Categories'],
        summary: '[Admin + Beautician] Get category by id',
        description: audienceAdminBeautician,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Category ObjectId')],
        responses: {
          ...okResponse(successExample(categoryExample)),
          ...withErrors(401, 403, 404, 422, 500),
        },
      },
      patch: {
        tags: ['Categories'],
        summary: '[Admin only] Update category',
        description: `${audienceAdminOnly}\n\nRequires \`categories.update\`. JSON or multipart. Optional \`file\` replaces the category image on S3.`,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Category ObjectId')],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                minProperties: 1,
                properties: createCategorySchema.properties,
              },
            },
            'application/json': {
              schema: {
                type: 'object',
                minProperties: 1,
                properties: jsonWithoutFile(createCategorySchema).properties,
              },
              example: { name: 'Hair', isFeatured: true },
            },
          },
        },
        responses: {
          ...okResponse(successExample(categoryExample)),
          ...withErrors(401, 403, 404, 409, 422, 500),
        },
      },
      delete: {
        tags: ['Categories'],
        summary: '[Admin only] Soft-delete category',
        description: `${audienceAdminOnly}\n\nRequires \`categories.delete\`.`,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Category ObjectId')],
        responses: {
          ...noContentResponse(),
          ...withErrors(401, 403, 404, 422, 500),
        },
      },
    },

    '/api/v1/categories/{id}/restore': {
      post: {
        tags: ['Categories'],
        summary: '[Admin only] Restore soft-deleted category',
        description: `${audienceAdminOnly}\n\nRequires \`categories.update\`.`,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Category ObjectId')],
        responses: {
          ...okResponse(successExample(categoryExample)),
          ...withErrors(400, 401, 403, 404, 409, 500),
        },
      },
    },

    '/api/v1/categories/{id}/status': {
      patch: {
        tags: ['Categories'],
        summary: '[Admin only] Set category active status',
        description: `${audienceAdminOnly}\n\nRequires \`categories.update\`.`,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Category ObjectId')],
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['isActive'],
            properties: { isActive: { type: 'boolean' } },
          },
          { isActive: false },
        ),
        responses: {
          ...okResponse(
            successExample({ ...categoryExample, isActive: false }),
          ),
          ...withErrors(401, 403, 404, 422, 500),
        },
      },
    },
  },
};
