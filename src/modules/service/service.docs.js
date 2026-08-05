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
  ServiceDiscountType,
  ServiceStatus,
  ServiceChangeRequestStatus,
  ServiceBadge,
  ServiceGender,
} from '../../common/constants/enums.js';

const serviceExample = {
  id: '64f0c2a1b4e1c2d3e4f50670',
  name: 'Bridal Bliss Package',
  slug: 'bridal-bliss-package',
  shortDescription: 'Complete bridal makeover',
  description: 'Full bridal package with makeup and spa.',
  categoryId: OBJECT_ID,
  images: [
    {
      url: 'https://cdn.example.com/services/bridal.jpg',
      publicId: 'services/bridal.jpg',
      isPrimary: true,
      displayOrder: 0,
    },
  ],
  thumbnail: {
    url: 'https://cdn.example.com/services/bridal-thumb.jpg',
    publicId: 'services/bridal-thumb.jpg',
  },
  video: { url: null, publicId: null },
  durationMinMinutes: 180,
  durationMaxMinutes: 240,
  price: 12000,
  discountType: ServiceDiscountType.PERCENTAGE,
  discountValue: 25,
  discountedPrice: 8999,
  approxPrice: 10000,
  badges: ['most_popular'],
  isPopular: true,
  isTrending: false,
  isFeatured: true,
  inclusions: [{ title: 'HD Bridal Makeup', displayOrder: 0 }],
  isHomeServiceAvailable: true,
  homeVisitFee: 0,
  rewardPointsMultiplier: 2,
  ratingAvg: 4.8,
  ratingCount: 128,
  tags: ['bridal'],
  gender: ServiceGender.FEMALE,
  status: ServiceStatus.APPROVED,
  displayOrder: 1,
  isActive: true,
};

const changeRequestExample = {
  id: '64f0c2a1b4e1c2d3e4f50671',
  serviceId: serviceExample.id,
  requestedBy: OBJECT_ID,
  status: ServiceChangeRequestStatus.PENDING,
  changes: { name: 'Bridal Bliss Package Premium' },
  previousValues: { name: 'Bridal Bliss Package' },
  changedFields: ['name'],
  diff: [
    {
      field: 'name',
      label: 'Name',
      previousValue: 'Bridal Bliss Package',
      newValue: 'Bridal Bliss Package Premium',
      type: 'string',
    },
  ],
  rejectedReason: null,
};

const audiencePublic =
  '**Audience:** Public (Customer / anyone) — **no auth**. Only APPROVED + active + priced services.';
const audienceStaff =
  '**Audience:** Admin **and** Beautician (`services.read`). Beautician sees **own** services only.';
const audienceAdminOnly =
  '**Audience:** Admin only. Beautician forbidden.';
const audienceBeauticianUpdate =
  '**Audience:** Admin + Beautician (`services.update`).\n\n' +
  '**Beautician:** does **not** mutate live Service — creates a `ServiceChangeRequest` with field diff. Pricing fields stripped.\n' +
  '**Admin:** updates live Service directly (pricing allowed).';

export const serviceDocs = {
  paths: {
    '/api/v1/services/public': {
      get: {
        tags: ['Services'],
        summary: '[Public] List approved services (all filters, slim, cached)',
        description: `${audiencePublic}\n\nCached ~300s. Supports filtering by categoryId, categorySlug, search query, price ranges, ratings, gender, tags, flags, and custom sorting.`,
        security: publicSecurity,
        parameters: [
          ...pageQueryParams({ page: 1, limit: 20 }),
          { name: 'categoryId', in: 'query', schema: { type: 'string' }, description: 'Category ObjectId filter' },
          { name: 'categorySlug', in: 'query', schema: { type: 'string' }, description: 'Category slug filter (e.g. hair-care)' },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Keyword search in name, description, tags, slug' },
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Alias for search' },
          { name: 'minPrice', in: 'query', schema: { type: 'number' }, description: 'Minimum price filter' },
          { name: 'maxPrice', in: 'query', schema: { type: 'number' }, description: 'Maximum price filter' },
          { name: 'minRating', in: 'query', schema: { type: 'number' }, description: 'Minimum average rating (0-5)' },
          { name: 'gender', in: 'query', schema: { type: 'string', enum: Object.values(ServiceGender) } },
          { name: 'tag', in: 'query', schema: { type: 'string' }, description: 'Tag filter (e.g. bridal, facial)' },
          { name: 'featured', in: 'query', schema: { type: 'boolean' } },
          { name: 'popular', in: 'query', schema: { type: 'boolean' } },
          { name: 'trending', in: 'query', schema: { type: 'boolean' } },
          { name: 'isHomeServiceAvailable', in: 'query', schema: { type: 'boolean' } },
          {
            name: 'sort',
            in: 'query',
            schema: {
              type: 'string',
              enum: [
                'displayOrder',
                'price_asc',
                'price_desc',
                'rating',
                'popular',
                'newest',
                'name',
              ],
              default: 'displayOrder',
            },
          },
        ],
        responses: {
          ...okResponse(
            successExample([serviceExample], { ...paginationMeta, total: 1 }),
          ),
          ...withErrors(422, 500),
        },
      },
    },
    '/api/v1/services/public/category/{categoryId}': {
      get: {
        tags: ['Services'],
        summary: '[Public] List approved services by category ID',
        description: `${audiencePublic}\n\nGet all active, approved services belonging to a specific category ID. Supports all query filters.`,
        security: publicSecurity,
        parameters: [
          objectIdParam('categoryId', 'Category ObjectId'),
          ...pageQueryParams({ page: 1, limit: 20 }),
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'minPrice', in: 'query', schema: { type: 'number' } },
          { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
          { name: 'sort', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          ...okResponse(
            successExample([serviceExample], { ...paginationMeta, total: 1 }),
          ),
          ...withErrors(404, 422, 500),
        },
      },
    },
    '/api/v1/services/public/{slug}': {
      get: {
        tags: ['Services'],
        summary: '[Public] Get approved service by slug',
        description: audiencePublic,
        security: publicSecurity,
        parameters: [
          {
            name: 'slug',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          ...okResponse(successExample(serviceExample)),
          ...withErrors(404, 422, 500),
        },
      },
    },
    '/api/v1/services': {
      get: {
        tags: ['Services'],
        summary: '[Admin + Beautician] List services',
        description: audienceStaff,
        security: bearerSecurity,
        parameters: [
          ...pageQueryParams({ page: 1, limit: 10 }),
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Keyword search filter' },
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: Object.values(ServiceStatus) },
            description: 'Filter by approval status (PENDING_APPROVAL, APPROVED, REJECTED)',
          },
          { name: 'categoryId', in: 'query', schema: { type: 'string' }, description: 'Category ObjectId filter' },
          { name: 'isActive', in: 'query', schema: { type: 'boolean' }, description: 'Active flag filter' },
          { name: 'isFeatured', in: 'query', schema: { type: 'boolean' } },
          { name: 'isPopular', in: 'query', schema: { type: 'boolean' } },
          { name: 'isTrending', in: 'query', schema: { type: 'boolean' } },
          { name: 'gender', in: 'query', schema: { type: 'string', enum: Object.values(ServiceGender) } },
          { name: 'tag', in: 'query', schema: { type: 'string' } },
          { name: 'includeDeleted', in: 'query', schema: { type: 'boolean', default: false }, description: 'Include soft-deleted services' },
          { name: 'sort', in: 'query', schema: { type: 'string', default: 'displayOrder -createdAt' } },
        ],
        responses: {
          ...okResponse(
            successExample([serviceExample], { ...paginationMeta, total: 1 }),
          ),
          ...withErrors(401, 403, 422, 500),
        },
      },
      post: {
        tags: ['Services'],
        summary: '[Admin + Beautician] Create service',
        description:
          `${audienceStaff}\n\nBeautician → status PENDING_APPROVAL + approxPrice only. Admin with price → APPROVED.`,
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['name', 'categoryId'],
                properties: {
                  name: { type: 'string', description: 'Service name (required)' },
                  slug: { type: 'string', description: 'Custom URL slug (optional)' },
                  shortDescription: { type: 'string', description: 'Short summary' },
                  description: { type: 'string', description: 'Full description' },
                  categoryId: { type: 'string', description: 'Category ObjectId (required)' },
                  approxPrice: { type: 'number', description: 'Estimated price (Beautician / Admin)' },
                  price: { type: 'number', description: 'Actual price (Admin only)' },
                  discountType: {
                    type: 'string',
                    enum: Object.values(ServiceDiscountType),
                    description: 'Discount type (NONE, PERCENTAGE, FIXED)',
                  },
                  discountValue: { type: 'number', description: 'Discount value (Admin only)' },
                  durationMinMinutes: { type: 'number', description: 'Min duration in minutes' },
                  durationMaxMinutes: { type: 'number', description: 'Max duration in minutes' },
                  badges: {
                    oneOf: [
                      { type: 'array', items: { type: 'string', enum: Object.values(ServiceBadge) } },
                      { type: 'string', example: '["most_popular"]' },
                    ],
                    description: 'Badges array, JSON string, or text (e.g. ["most_popular"] or most_popular)',
                  },
                  isPopular: { type: 'boolean', default: false },
                  isTrending: { type: 'boolean', default: false },
                  isFeatured: { type: 'boolean', default: false },
                  isActive: { type: 'boolean', default: true },
                  inclusions: {
                    oneOf: [
                      {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            title: { type: 'string' },
                            displayOrder: { type: 'number' },
                          },
                        },
                      },
                      { type: 'string', example: '[{"title": "Exfoliation", "displayOrder": 0}]' },
                    ],
                    description: 'JSON array string of inclusions, e.g. [{"title": "Exfoliation", "displayOrder": 0}]',
                  },
                  isHomeServiceAvailable: { type: 'boolean', default: false },
                  homeVisitFee: { type: 'number', default: 0 },
                  rewardPointsMultiplier: { type: 'number', default: 1 },
                  gender: {
                    type: 'string',
                    enum: Object.values(ServiceGender),
                    default: 'all',
                  },
                  tags: {
                    oneOf: [
                      { type: 'array', items: { type: 'string' } },
                      { type: 'string', example: '["facial", "glowing"]' },
                    ],
                    description: 'Tags array, JSON string, or text (e.g. ["facial", "glowing"] or facial)',
                  },
                  displayOrder: { type: 'number', default: 0 },
                  metadata: {
                    oneOf: [{ type: 'object' }, { type: 'string', example: '{}' }],
                    description: 'Custom key-value JSON string or object (e.g. {})',
                  },
                  files: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' },
                    description: 'Gallery image files',
                  },
                  thumbnail: {
                    type: 'string',
                    format: 'binary',
                    description: 'Thumbnail image file',
                  },
                },
              },
            },
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'categoryId'],
                properties: {
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  shortDescription: { type: 'string' },
                  description: { type: 'string' },
                  categoryId: { type: 'string' },
                  approxPrice: { type: 'number' },
                  price: { type: 'number' },
                  discountType: { type: 'string', enum: Object.values(ServiceDiscountType) },
                  discountValue: { type: 'number' },
                  durationMinMinutes: { type: 'number' },
                  durationMaxMinutes: { type: 'number' },
                  badges: {
                    type: 'array',
                    items: { type: 'string', enum: Object.values(ServiceBadge) },
                  },
                  isPopular: { type: 'boolean' },
                  isTrending: { type: 'boolean' },
                  isFeatured: { type: 'boolean' },
                  isActive: { type: 'boolean' },
                  inclusions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        displayOrder: { type: 'number' },
                      },
                    },
                  },
                  isHomeServiceAvailable: { type: 'boolean' },
                  homeVisitFee: { type: 'number' },
                  rewardPointsMultiplier: { type: 'number' },
                  gender: { type: 'string', enum: Object.values(ServiceGender) },
                  tags: { type: 'array', items: { type: 'string' } },
                  displayOrder: { type: 'number' },
                  metadata: { type: 'object' },
                },
              },
              example: {
                name: 'Bridal Bliss Package',
                categoryId: OBJECT_ID,
                approxPrice: 10000,
                shortDescription: 'Complete bridal makeover',
                description: 'Full bridal makeover with makeup and spa.',
                durationMinMinutes: 120,
                durationMaxMinutes: 180,
                gender: 'female',
                isHomeServiceAvailable: true,
                tags: ['bridal', 'makeup'],
              },
            },
          },
        },
        responses: {
          ...createdResponse(successExample(serviceExample)),
          ...withErrors(401, 403, 409, 422, 500),
        },
      },
    },
    '/api/v1/services/reorder': {
      patch: {
        tags: ['Services'],
        summary: '[Admin only] Reorder services',
        description: `${audienceAdminOnly}\n\nBulk update displayOrder for multiple services.`,
        security: bearerSecurity,
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['items'],
            properties: {
              items: {
                type: 'array',
                minItems: 1,
                items: {
                  type: 'object',
                  required: ['id', 'displayOrder'],
                  properties: {
                    id: { type: 'string', description: 'Service ObjectId' },
                    displayOrder: { type: 'number', minimum: 0 },
                  },
                },
              },
            },
          },
          {
            items: [
              { id: '64f0c2a1b4e1c2d3e4f50670', displayOrder: 1 },
              { id: '64f0c2a1b4e1c2d3e4f50671', displayOrder: 2 },
            ],
          },
        ),
        responses: {
          ...okResponse(successExample({ count: 2 })),
          ...withErrors(401, 403, 422, 500),
        },
      },
    },
    '/api/v1/services/bulk/status': {
      patch: {
        tags: ['Services'],
        summary: '[Admin only] Bulk update service active status',
        description: `${audienceAdminOnly}\n\nBatch activate or deactivate multiple services.`,
        security: bearerSecurity,
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['ids', 'isActive'],
            properties: {
              ids: {
                type: 'array',
                items: { type: 'string' },
                minItems: 1,
                maxItems: 100,
                description: 'Array of Service ObjectIds',
              },
              isActive: { type: 'boolean', description: 'New active status' },
            },
          },
          {
            ids: ['64f0c2a1b4e1c2d3e4f50670'],
            isActive: false,
          },
        ),
        responses: {
          ...okResponse(successExample({ modifiedCount: 1 })),
          ...withErrors(401, 403, 422, 500),
        },
      },
    },
    '/api/v1/services/bulk/delete': {
      post: {
        tags: ['Services'],
        summary: '[Admin only] Bulk soft-delete services',
        description: `${audienceAdminOnly}\n\nBatch soft-delete multiple services.`,
        security: bearerSecurity,
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['ids'],
            properties: {
              ids: {
                type: 'array',
                items: { type: 'string' },
                minItems: 1,
                maxItems: 100,
                description: 'Array of Service ObjectIds',
              },
            },
          },
          {
            ids: ['64f0c2a1b4e1c2d3e4f50670'],
          },
        ),
        responses: {
          ...okResponse(successExample({ deletedCount: 1 })),
          ...withErrors(401, 403, 422, 500),
        },
      },
    },
    '/api/v1/services/{id}': {
      get: {
        tags: ['Services'],
        summary: '[Admin + Beautician] Get service by id',
        description: audienceStaff,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Service ObjectId')],
        responses: {
          ...okResponse(successExample(serviceExample)),
          ...withErrors(401, 403, 404, 422, 500),
        },
      },
      patch: {
        tags: ['Services'],
        summary: '[Admin + Beautician] Update service',
        description: audienceBeauticianUpdate,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Service ObjectId')],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  shortDescription: { type: 'string' },
                  description: { type: 'string' },
                  categoryId: { type: 'string' },
                  approxPrice: { type: 'number' },
                  price: { type: 'number', description: 'Admin only' },
                  discountType: { type: 'string', enum: Object.values(ServiceDiscountType) },
                  discountValue: { type: 'number' },
                  durationMinMinutes: { type: 'number' },
                  durationMaxMinutes: { type: 'number' },
                  badges: {
                    oneOf: [
                      { type: 'array', items: { type: 'string', enum: Object.values(ServiceBadge) } },
                      { type: 'string', example: '["most_popular"]' },
                    ],
                  },
                  isPopular: { type: 'boolean' },
                  isTrending: { type: 'boolean' },
                  isFeatured: { type: 'boolean' },
                  isActive: { type: 'boolean' },
                  inclusions: {
                    oneOf: [
                      {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            title: { type: 'string' },
                            displayOrder: { type: 'number' },
                          },
                        },
                      },
                      { type: 'string', example: '[{"title": "Exfoliation", "displayOrder": 0}]' },
                    ],
                  },
                  isHomeServiceAvailable: { type: 'boolean' },
                  homeVisitFee: { type: 'number' },
                  rewardPointsMultiplier: { type: 'number' },
                  gender: { type: 'string', enum: Object.values(ServiceGender) },
                  tags: {
                    oneOf: [
                      { type: 'array', items: { type: 'string' } },
                      { type: 'string', example: '["facial", "glowing"]' },
                    ],
                  },
                  displayOrder: { type: 'number' },
                  metadata: {
                    oneOf: [{ type: 'object' }, { type: 'string', example: '{}' }],
                  },
                  files: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' },
                  },
                  thumbnail: { type: 'string', format: 'binary' },
                },
              },
            },
            'application/json': {
              schema: {
                type: 'object',
                minProperties: 1,
                properties: {
                  name: { type: 'string' },
                  shortDescription: { type: 'string' },
                  description: { type: 'string' },
                  approxPrice: { type: 'number' },
                  price: { type: 'number' },
                  gender: { type: 'string', enum: Object.values(ServiceGender) },
                  isHomeServiceAvailable: { type: 'boolean' },
                },
              },
              example: { name: 'Bridal Bliss Package Premium', approxPrice: 12000 },
            },
          },
        },
        responses: {
          ...okResponse(
            successExample({
              changeRequest: changeRequestExample,
              liveUnchanged: true,
            }),
          ),
          ...withErrors(401, 403, 404, 409, 422, 500),
        },
      },
      delete: {
        tags: ['Services'],
        summary: '[Admin only] Soft-delete service',
        description: audienceAdminOnly,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Service ObjectId')],
        responses: {
          ...noContentResponse(),
          ...withErrors(401, 403, 404, 422, 500),
        },
      },
    },
    '/api/v1/services/{id}/restore': {
      post: {
        tags: ['Services'],
        summary: '[Admin only] Restore soft-deleted service',
        description: `${audienceAdminOnly}\n\nRestores a soft-deleted service back to active pool.`,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Service ObjectId')],
        responses: {
          ...okResponse(successExample(serviceExample)),
          ...withErrors(401, 403, 404, 422, 500),
        },
      },
    },
    '/api/v1/services/{id}/status': {
      patch: {
        tags: ['Services'],
        summary: '[Admin only] Toggle single service active status',
        description: `${audienceAdminOnly}\n\nUpdate isActive flag for a single service.`,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Service ObjectId')],
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['isActive'],
            properties: {
              isActive: { type: 'boolean', description: 'New active status' },
            },
          },
          { isActive: true },
        ),
        responses: {
          ...okResponse(successExample(serviceExample)),
          ...withErrors(401, 403, 404, 422, 500),
        },
      },
    },
    '/api/v1/services/{id}/approve': {
      post: {
        tags: ['Services'],
        summary: '[Admin only] Approve created service (set price)',
        description: `${audienceAdminOnly}\n\nRequires \`price\`.`,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Service ObjectId')],
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['price'],
            properties: {
              price: { type: 'number' },
              discountType: {
                type: 'string',
                enum: Object.values(ServiceDiscountType),
              },
              discountValue: { type: 'number' },
              reviewedNote: { type: 'string' },
            },
          },
          { price: 12000, discountType: 'PERCENTAGE', discountValue: 25 },
        ),
        responses: {
          ...okResponse(successExample(serviceExample)),
          ...withErrors(400, 401, 403, 404, 422, 500),
        },
      },
    },
    '/api/v1/services/{id}/reject': {
      post: {
        tags: ['Services'],
        summary: '[Admin only] Reject created service',
        description: `${audienceAdminOnly}\n\n\`rejectionReason\` required.`,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Service ObjectId')],
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['rejectionReason'],
            properties: { rejectionReason: { type: 'string' } },
          },
          { rejectionReason: 'Incomplete description and missing images' },
        ),
        responses: {
          ...okResponse(
            successExample({
              ...serviceExample,
              status: ServiceStatus.REJECTED,
            }),
          ),
          ...withErrors(401, 403, 404, 422, 500),
        },
      },
    },
    '/api/v1/service-change-requests': {
      get: {
        tags: ['Service Change Requests'],
        summary: '[Admin + Beautician] List change requests',
        description:
          'Admin: full queue. Beautician: own requests (`mine=true` auto). Includes field-by-field `diff` for panel.',
        security: bearerSecurity,
        parameters: [
          ...pageQueryParams({ page: 1, limit: 10 }),
          {
            name: 'status',
            in: 'query',
            schema: {
              type: 'string',
              enum: Object.values(ServiceChangeRequestStatus),
            },
            description: 'Filter by status (PENDING, APPROVED, REJECTED)',
          },
          { name: 'serviceId', in: 'query', schema: { type: 'string' }, description: 'Filter by Service ObjectId' },
          { name: 'requestedBy', in: 'query', schema: { type: 'string' }, description: 'Filter by User ObjectId' },
          { name: 'mine', in: 'query', schema: { type: 'boolean' }, description: 'Filter to current user\'s requests' },
          { name: 'sort', in: 'query', schema: { type: 'string', default: '-createdAt' } },
        ],
        responses: {
          ...okResponse(
            successExample([changeRequestExample], {
              ...paginationMeta,
              total: 1,
            }),
          ),
          ...withErrors(401, 403, 422, 500),
        },
      },
    },
    '/api/v1/service-change-requests/{id}': {
      get: {
        tags: ['Service Change Requests'],
        summary: '[Admin + Beautician] Get change request + diff',
        description:
          'Panel review payload: `diff[]` with previousValue vs newValue (including images).',
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Change request ObjectId')],
        responses: {
          ...okResponse(successExample(changeRequestExample)),
          ...withErrors(401, 403, 404, 422, 500),
        },
      },
    },
    '/api/v1/service-change-requests/{id}/approve': {
      post: {
        tags: ['Service Change Requests'],
        summary: '[Admin only] Approve change request (apply to live)',
        description:
          'Applies only `changes` to live Service. Existing bookings unaffected. Optional price override in body.',
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Change request ObjectId')],
        requestBody: jsonBody(
          {
            type: 'object',
            properties: {
              price: { type: 'number' },
              discountType: {
                type: 'string',
                enum: Object.values(ServiceDiscountType),
              },
              discountValue: { type: 'number' },
              reviewedNote: { type: 'string' },
            },
          },
          { reviewedNote: 'Looks good' },
        ),
        responses: {
          ...okResponse(
            successExample({
              changeRequest: {
                ...changeRequestExample,
                status: ServiceChangeRequestStatus.APPROVED,
              },
              service: serviceExample,
            }),
          ),
          ...withErrors(401, 403, 404, 409, 422, 500),
        },
      },
    },
    '/api/v1/service-change-requests/{id}/reject': {
      post: {
        tags: ['Service Change Requests'],
        summary: '[Admin only] Reject change request',
        description:
          'Live Service unchanged. `rejectedReason` required for panel + beautician.',
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Change request ObjectId')],
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['rejectedReason'],
            properties: { rejectedReason: { type: 'string' } },
          },
          { rejectedReason: 'Image quality too low; please re-upload' },
        ),
        responses: {
          ...okResponse(
            successExample({
              ...changeRequestExample,
              status: ServiceChangeRequestStatus.REJECTED,
              rejectedReason: 'Image quality too low; please re-upload',
            }),
          ),
          ...withErrors(400, 401, 403, 404, 422, 500),
        },
      },
    },
  },
};
