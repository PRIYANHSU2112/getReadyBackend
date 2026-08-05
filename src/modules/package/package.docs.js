import {
  publicSecurity,
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
import {
  PackageType,
  PackageStatus,
  PackageGender,
  PackageDiscountType,
  PackageBadge,
  PackageChangeRequestStatus,
} from './package.enum.js';

const packageItemExample = {
  serviceId: '64f0c2a1b4e1c2d3e4f50670',
  categoryId: '64f0c2a1b4e1c2d3e4f50671',
  groupTitle: 'Facial & Cleanup',
  isMandatory: true,
  isDefaultSelected: true,
  badgeTags: ['Popular', 'Must Try'],
  extraCharge: 0,
  displayOrder: 0,
};

const packageExample = {
  id: OBJECT_ID,
  name: 'Bliss Package',
  slug: 'bliss-package',
  badgeTag: 'Book Any 4 Services',
  shortDescription: 'Everything you need for your perfect wedding day.',
  description: 'Full head to toe bridal package.',
  packageType: PackageType.CUSTOMIZABLE,
  minSelectCount: 4,
  maxSelectCount: 4,
  selectionNotice: 'You can add 4 services only in this package.',
  items: [packageItemExample],
  categoryIds: ['64f0c2a1b4e1c2d3e4f50671'],
  thumbnail: {
    url: 'https://cdn.example.com/packages/bliss-thumb.jpg',
    publicId: 'packages/bliss-thumb.jpg',
  },
  images: [
    {
      url: 'https://cdn.example.com/packages/bliss-banner.jpg',
      publicId: 'packages/bliss-banner.jpg',
      displayOrder: 0,
    },
  ],
  durationMinMinutes: 180,
  durationMaxMinutes: 240,
  originalPrice: 12000,
  price: 999,
  discountType: PackageDiscountType.PERCENTAGE,
  discountValue: 25,
  discountedPrice: 749,
  approxPrice: 1000,
  badges: [PackageBadge.MOST_POPULAR],
  ratingAvg: 4.8,
  ratingCount: 128,
  bookingCount: 2090,
  socialProofText: '2,090 Women Booked in last 4 days',
  status: PackageStatus.APPROVED,
  gender: PackageGender.FEMALE,
  isPopular: true,
  isTrending: false,
  isFeatured: true,
  isHomeServiceAvailable: true,
  isActive: true,
  displayOrder: 0,
};

const packageChangeRequestExample = {
  id: '64f0c2a1b4e1c2d3e4f50680',
  packageId: packageExample.id,
  requestedBy: OBJECT_ID,
  status: PackageChangeRequestStatus.PENDING,
  changes: { name: 'Bliss Package Premium' },
  diff: [
    {
      field: 'name',
      label: 'Package Name',
      oldValue: 'Bliss Package',
      newValue: 'Bliss Package Premium',
    },
  ],
  rejectionReason: null,
};

const audiencePublic =
  '**Audience:** Public (Customer / anyone) — **no auth**. Only APPROVED + active + priced packages.';
const audienceStaff =
  '**Audience:** Admin **and** Beautician. Beautician sees **own** packages only.';
const audienceAdminOnly =
  '**Audience:** Admin only. Beautician forbidden.';
const audienceBeauticianUpdate =
  '**Audience:** Admin + Beautician.\n\n' +
  '**Beautician:** does **not** mutate live Package — creates a `PackageChangeRequest` with field diff. Pricing fields stripped.\n' +
  '**Admin:** updates live Package directly (pricing allowed).';

export const packageDocs = {
  paths: {
    '/api/v1/packages/public': {
      get: {
        tags: ['Packages'],
        summary: '[Public] List approved packages with filters & pagination',
        description: audiencePublic,
        security: publicSecurity,
        parameters: [
          ...pageQueryParams({ page: 1, limit: 10 }),
          { name: 'categoryId', in: 'query', schema: { type: 'string' }, description: 'Filter by Category ObjectId' },
          { name: 'categorySlug', in: 'query', schema: { type: 'string' }, description: 'Filter by Category slug' },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Keyword search in name, shortDescription, tags' },
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Alias for search' },
          { name: 'minPrice', in: 'query', schema: { type: 'number' }, description: 'Minimum price filter' },
          { name: 'maxPrice', in: 'query', schema: { type: 'number' }, description: 'Maximum price filter' },
          { name: 'minRating', in: 'query', schema: { type: 'number' }, description: 'Minimum average rating' },
          { name: 'gender', in: 'query', schema: { type: 'string', enum: Object.values(PackageGender) } },
          { name: 'packageType', in: 'query', schema: { type: 'string', enum: Object.values(PackageType) } },
          { name: 'isPopular', in: 'query', schema: { type: 'boolean' } },
          { name: 'isFeatured', in: 'query', schema: { type: 'boolean' } },
          { name: 'isTrending', in: 'query', schema: { type: 'boolean' } },
          { name: 'isHomeServiceAvailable', in: 'query', schema: { type: 'boolean' } },
          {
            name: 'sort',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['price_asc', 'price_desc', 'rating', 'popular', 'newest', 'displayOrder'],
              default: 'displayOrder',
            },
          },
        ],
        responses: {
          ...okResponse(successExample([packageExample])),
          ...withErrors(400, 500),
        },
      },
    },

    '/api/v1/packages/public/category/{categoryId}': {
      get: {
        tags: ['Packages'],
        summary: '[Public] List approved packages by category ID',
        description: `${audiencePublic}\n\nGet all public, active packages belonging to a specific category ID.`,
        security: publicSecurity,
        parameters: [
          objectIdParam('categoryId', 'Category ObjectId'),
          ...pageQueryParams({ page: 1, limit: 10 }),
        ],
        responses: {
          ...okResponse(successExample([packageExample])),
          ...withErrors(400, 404, 500),
        },
      },
    },

    '/api/v1/packages/public/slug/{slug}': {
      get: {
        tags: ['Packages'],
        summary: '[Public] Get public package details by slug',
        description: audiencePublic,
        security: publicSecurity,
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          ...okResponse(successExample(packageExample)),
          ...withErrors(404, 500),
        },
      },
    },

    '/api/v1/packages/public/{id}': {
      get: {
        tags: ['Packages'],
        summary: '[Public] Get public package details by ObjectId',
        description: audiencePublic,
        security: publicSecurity,
        parameters: [objectIdParam('id', 'Package ObjectId')],
        responses: {
          ...okResponse(successExample(packageExample)),
          ...withErrors(404, 500),
        },
      },
    },

    '/api/v1/packages': {
      get: {
        tags: ['Packages'],
        summary: '[Admin + Beautician] List packages queue',
        description: `${audienceStaff}\n\nStaff / Admin view for packages. Includes PENDING_APPROVAL and REJECTED statuses.`,
        security: bearerSecurity,
        parameters: [
          ...pageQueryParams(),
          { name: 'status', in: 'query', schema: { type: 'string', enum: Object.values(PackageStatus) } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          ...okResponse(successExample([packageExample])),
          ...withErrors(401, 403, 500),
        },
      },
      post: {
        tags: ['Packages'],
        summary: '[Admin + Beautician] Create package',
        description: `${audienceStaff}\n\nBeautician -> status PENDING_APPROVAL + approxPrice only. Admin with price -> APPROVED.`,
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['name', 'items'],
                properties: {
                  name: { type: 'string', description: 'Package name (required)' },
                  slug: { type: 'string', description: 'Custom URL slug (optional)' },
                  badgeTag: { type: 'string', description: 'Tag text (e.g. Book Any 4 Services)' },
                  shortDescription: { type: 'string' },
                  description: { type: 'string' },
                  packageType: { type: 'string', enum: Object.values(PackageType), default: 'FIXED' },
                  minSelectCount: { type: 'number' },
                  maxSelectCount: { type: 'number' },
                  selectionNotice: { type: 'string' },
                  items: {
                    oneOf: [
                      {
                        type: 'array',
                        items: {
                          type: 'object',
                          required: ['serviceId', 'categoryId'],
                          properties: {
                            serviceId: { type: 'string' },
                            categoryId: { type: 'string' },
                            groupTitle: { type: 'string' },
                            isMandatory: { type: 'boolean' },
                            isDefaultSelected: { type: 'boolean' },
                            badgeTags: { type: 'array', items: { type: 'string' } },
                            extraCharge: { type: 'number' },
                            displayOrder: { type: 'number' },
                          },
                        },
                      },
                      { type: 'string', example: '[{"serviceId": "64f0c2a1b4e1c2d3e4f50670", "categoryId": "64f0c2a1b4e1c2d3e4f50671"}]' },
                    ],
                    description: 'Array of package items or JSON array string',
                  },
                  durationMinMinutes: { type: 'number' },
                  durationMaxMinutes: { type: 'number' },
                  originalPrice: { type: 'number' },
                  approxPrice: { type: 'number', description: 'Estimated price (Beautician/Admin)' },
                  price: { type: 'number', description: 'Actual price (Admin only)' },
                  discountType: { type: 'string', enum: Object.values(PackageDiscountType) },
                  discountValue: { type: 'number' },
                  badges: {
                    oneOf: [
                      { type: 'array', items: { type: 'string', enum: Object.values(PackageBadge) } },
                      { type: 'string', example: '["most_popular"]' },
                    ],
                  },
                  socialProofText: { type: 'string' },
                  gender: { type: 'string', enum: Object.values(PackageGender), default: 'female' },
                  isPopular: { type: 'boolean' },
                  isTrending: { type: 'boolean' },
                  isFeatured: { type: 'boolean' },
                  isHomeServiceAvailable: { type: 'boolean' },
                  isActive: { type: 'boolean' },
                  displayOrder: { type: 'number' },
                  metadata: {
                    oneOf: [{ type: 'object' }, { type: 'string', example: '{}' }],
                  },
                  thumbnail: {
                    type: 'string',
                    format: 'binary',
                    description: 'Thumbnail image file',
                  },
                  images: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' },
                    description: 'Gallery banner image files',
                  },
                  files: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' },
                    description: 'Alias gallery image files',
                  },
                },
              },
            },
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'items'],
                properties: {
                  name: { type: 'string', description: 'Package name (required)' },
                  slug: { type: 'string', description: 'Custom URL slug (optional)' },
                  badgeTag: { type: 'string', description: 'Tag text (e.g. Book Any 4 Services)' },
                  shortDescription: { type: 'string' },
                  description: { type: 'string' },
                  packageType: { type: 'string', enum: Object.values(PackageType), default: 'FIXED' },
                  minSelectCount: { type: 'number' },
                  maxSelectCount: { type: 'number' },
                  selectionNotice: { type: 'string' },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['serviceId', 'categoryId'],
                      properties: {
                        serviceId: { type: 'string' },
                        categoryId: { type: 'string' },
                        groupTitle: { type: 'string' },
                        isMandatory: { type: 'boolean' },
                        isDefaultSelected: { type: 'boolean' },
                        badgeTags: { type: 'array', items: { type: 'string' } },
                        extraCharge: { type: 'number' },
                        displayOrder: { type: 'number' },
                      },
                    },
                  },
                  durationMinMinutes: { type: 'number' },
                  durationMaxMinutes: { type: 'number' },
                  originalPrice: { type: 'number' },
                  approxPrice: { type: 'number', description: 'Estimated price (Beautician/Admin)' },
                  price: { type: 'number', description: 'Actual price (Admin only)' },
                  discountType: { type: 'string', enum: Object.values(PackageDiscountType) },
                  discountValue: { type: 'number' },
                  badges: {
                    type: 'array',
                    items: { type: 'string', enum: Object.values(PackageBadge) },
                  },
                  socialProofText: { type: 'string' },
                  gender: { type: 'string', enum: Object.values(PackageGender), default: 'female' },
                  isPopular: { type: 'boolean' },
                  isTrending: { type: 'boolean' },
                  isFeatured: { type: 'boolean' },
                  isHomeServiceAvailable: { type: 'boolean' },
                  isActive: { type: 'boolean' },
                  displayOrder: { type: 'number' },
                  metadata: { type: 'object' },
                },
              },
            },
          },
        },
        responses: {
          ...createdResponse(successExample(packageExample)),
          ...withErrors(400, 401, 403, 422, 500),
        },
      },
    },

    '/api/v1/packages/{id}': {
      patch: {
        tags: ['Packages'],
        summary: '[Admin + Beautician] Update package',
        description: audienceBeauticianUpdate,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Package ObjectId')],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                minProperties: 1,
                properties: {
                  name: { type: 'string' },
                  shortDescription: { type: 'string' },
                  description: { type: 'string' },
                  approxPrice: { type: 'number' },
                  price: { type: 'number', description: 'Admin only' },
                  discountType: { type: 'string', enum: Object.values(PackageDiscountType) },
                  discountValue: { type: 'number' },
                  gender: { type: 'string', enum: Object.values(PackageGender) },
                  isActive: { type: 'boolean' },
                  thumbnail: {
                    type: 'string',
                    format: 'binary',
                    description: 'Thumbnail image file',
                  },
                  images: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' },
                    description: 'Gallery banner image files',
                  },
                  files: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' },
                    description: 'Alias gallery image files',
                  },
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
                  price: { type: 'number', description: 'Admin only' },
                  discountType: { type: 'string', enum: Object.values(PackageDiscountType) },
                  discountValue: { type: 'number' },
                  gender: { type: 'string', enum: Object.values(PackageGender) },
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          ...okResponse(successExample(packageExample)),
          ...withErrors(401, 403, 404, 422, 500),
        },
      },
      delete: {
        tags: ['Packages'],
        summary: '[Admin only] Soft-delete package',
        description: audienceAdminOnly,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Package ObjectId')],
        responses: {
          ...okResponse(successExample({ message: 'Package soft-deleted successfully' })),
          ...withErrors(401, 403, 404, 500),
        },
      },
    },

    '/api/v1/packages/{id}/approve': {
      post: {
        tags: ['Packages'],
        summary: '[Admin only] Approve created package with final price',
        description: `${audienceAdminOnly}\n\nRequires \`price\`.`,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Package ObjectId')],
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['price'],
            properties: {
              price: { type: 'number' },
              discountType: { type: 'string', enum: Object.values(PackageDiscountType) },
              discountValue: { type: 'number' },
            },
          },
          { price: 999, discountType: 'PERCENTAGE', discountValue: 25 },
        ),
        responses: {
          ...okResponse(successExample(packageExample)),
          ...withErrors(401, 403, 404, 422, 500),
        },
      },
    },

    '/api/v1/packages/{id}/reject': {
      post: {
        tags: ['Packages'],
        summary: '[Admin only] Reject created package with reason',
        description: `${audienceAdminOnly}\n\n\`rejectionReason\` required.`,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Package ObjectId')],
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['rejectionReason'],
            properties: {
              rejectionReason: { type: 'string' },
            },
          },
          { rejectionReason: 'Incomplete items list and invalid pricing' },
        ),
        responses: {
          ...okResponse(successExample({ ...packageExample, status: PackageStatus.REJECTED })),
          ...withErrors(401, 403, 404, 422, 500),
        },
      },
    },

    '/api/v1/packages/change-requests/list': {
      get: {
        tags: ['Package Change Requests'],
        summary: '[Admin + Beautician] List package change requests',
        description: 'Admin lists all pending/reviewed change requests. Beautician lists own change requests.',
        security: bearerSecurity,
        parameters: [
          ...pageQueryParams(),
          { name: 'status', in: 'query', schema: { type: 'string', enum: Object.values(PackageChangeRequestStatus) } },
        ],
        responses: {
          ...okResponse(successExample([packageChangeRequestExample])),
          ...withErrors(401, 403, 500),
        },
      },
    },

    '/api/v1/packages/change-requests/{id}/approve': {
      post: {
        tags: ['Package Change Requests'],
        summary: '[Admin only] Approve package change request (apply to live)',
        description: 'Applies only changes to live Package. Existing bookings unaffected.',
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Change Request ObjectId')],
        responses: {
          ...okResponse(successExample({ package: packageExample, changeRequestStatus: PackageChangeRequestStatus.APPROVED })),
          ...withErrors(401, 403, 404, 400, 500),
        },
      },
    },

    '/api/v1/packages/change-requests/{id}/reject': {
      post: {
        tags: ['Package Change Requests'],
        summary: '[Admin only] Reject package change request',
        description: 'Live package remains unchanged.',
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Change Request ObjectId')],
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['rejectionReason'],
            properties: {
              rejectionReason: { type: 'string' },
            },
          },
          { rejectionReason: 'Changes conflict with promotional campaign' },
        ),
        responses: {
          ...okResponse(successExample({ ...packageChangeRequestExample, status: PackageChangeRequestStatus.REJECTED })),
          ...withErrors(401, 403, 404, 400, 422, 500),
        },
      },
    },
  },
};
