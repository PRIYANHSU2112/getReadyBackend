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

export const packageDocs = {
  paths: {
    '/api/v1/packages/public': {
      get: {
        tags: ['Packages'],
        summary: 'Get public packages with filters & pagination',
        security: publicSecurity,
        parameters: [
          ...pageQueryParams(),
          { name: 'categoryId', in: 'query', schema: { type: 'string' } },
          { name: 'categorySlug', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'minPrice', in: 'query', schema: { type: 'number' } },
          { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
          { name: 'minRating', in: 'query', schema: { type: 'number' } },
          { name: 'gender', in: 'query', schema: { type: 'string', enum: Object.values(PackageGender) } },
          { name: 'packageType', in: 'query', schema: { type: 'string', enum: Object.values(PackageType) } },
          { name: 'isPopular', in: 'query', schema: { type: 'boolean' } },
          { name: 'isFeatured', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: {
          ...okResponse(successExample([packageExample])),
          ...withErrors(400, 500),
        },
      },
    },

    '/api/v1/packages/public/slug/{slug}': {
      get: {
        tags: ['Packages'],
        summary: 'Get public package by slug',
        security: publicSecurity,
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          ...okResponse(successExample(packageExample)),
          ...withErrors(404, 500),
        },
      },
    },

    '/api/v1/packages': {
      get: {
        tags: ['Packages - Staff/Admin'],
        summary: 'List packages (Admin & Beautician)',
        security: bearerSecurity,
        parameters: [...pageQueryParams()],
        responses: {
          ...okResponse(successExample([packageExample])),
          ...withErrors(401, 403, 500),
        },
      },
      post: {
        tags: ['Packages - Staff/Admin'],
        summary: 'Create package',
        description: 'Beautician -> status PENDING_APPROVAL + approxPrice only. Admin with price -> APPROVED.',
        security: bearerSecurity,
        requestBody: jsonBody({
          type: 'object',
          required: ['name', 'items'],
          properties: {
            name: { type: 'string' },
            badgeTag: { type: 'string' },
            packageType: { type: 'string', enum: Object.values(PackageType) },
            minSelectCount: { type: 'number' },
            maxSelectCount: { type: 'number' },
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
                },
              },
            },
            approxPrice: { type: 'number' },
            price: { type: 'number', description: 'Admin only' },
          },
        }),
        responses: {
          ...createdResponse(successExample(packageExample)),
          ...withErrors(400, 401, 403, 422, 500),
        },
      },
    },

    '/api/v1/packages/{id}/approve': {
      post: {
        tags: ['Packages - Admin'],
        summary: 'Approve package with final price',
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Package ObjectId')],
        requestBody: jsonBody({
          type: 'object',
          required: ['price'],
          properties: {
            price: { type: 'number' },
            discountType: { type: 'string', enum: Object.values(PackageDiscountType) },
            discountValue: { type: 'number' },
          },
        }),
        responses: {
          ...okResponse(successExample(packageExample)),
          ...withErrors(401, 403, 404, 422, 500),
        },
      },
    },

    '/api/v1/packages/{id}/reject': {
      post: {
        tags: ['Packages - Admin'],
        summary: 'Reject package with reason',
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Package ObjectId')],
        requestBody: jsonBody({
          type: 'object',
          required: ['rejectionReason'],
          properties: {
            rejectionReason: { type: 'string' },
          },
        }),
        responses: {
          ...okResponse(successExample(packageExample)),
          ...withErrors(401, 403, 404, 422, 500),
        },
      },
    },
  },
};
