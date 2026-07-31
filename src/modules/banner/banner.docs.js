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
import {
  BannerType,
  BannerStatus,
  BannerPlatform,
} from '../../common/constants/enums.js';
import {
  MIN_BANNER_POSITION,
  MAX_BANNER_POSITION,
  MAX_BANNERS_PER_POSITION,
  DEFAULT_BANNER_SORT,
  BANNER_SORT_FIELDS,
} from '../../common/constants/banner.js';

const typeValues = Object.values(BannerType);
const statusValues = Object.values(BannerStatus);
const platformValues = Object.values(BannerPlatform);
const sortEnum = BANNER_SORT_FIELDS.flatMap((field) => [field, `-${field}`]);

const bannerExample = {
  id: '64f0c2a1b4e1c2d3e4f50640',
  title: 'Summer Glow Offer',
  image: {
    url: 'https://cdn.example.com/banners/summer-glow.jpg',
    publicId: 'banners/summer-glow.jpg',
  },
  imageUrl: 'https://cdn.example.com/banners/summer-glow.jpg',
  linkUrl: 'https://example.com/offers/summer',
  position: 1,
  categoryId: OBJECT_ID,
  serviceCategory: 'hair',
  serviceIds: [OBJECT_ID],
  type: BannerType.OFFER,
  status: BannerStatus.ACTIVE,
  sortOrder: 0,
  startAt: '2026-07-01T00:00:00.000Z',
  endAt: '2026-08-31T23:59:59.000Z',
  platform: BannerPlatform.ALL,
  deletedAt: null,
  createdAt: '2026-07-25T05:00:00.000Z',
  updatedAt: '2026-07-25T05:00:00.000Z',
};

const formFields = {
  title: { type: 'string', example: 'Summer Glow Offer' },
  linkUrl: {
    type: 'string',
    nullable: true,
    example: 'https://example.com/offers/summer',
  },
  position: {
    type: 'integer',
    minimum: MIN_BANNER_POSITION,
    maximum: MAX_BANNER_POSITION,
    example: 1,
  },
  categoryId: {
    type: 'string',
    nullable: true,
    example: OBJECT_ID,
    description: 'Category ObjectId — denormalizes slug into serviceCategory',
  },
  serviceCategory: {
    type: 'string',
    nullable: true,
    example: 'hair',
    description: 'Legacy category slug/name; auto-set from categoryId when provided',
  },
  serviceIds: {
    type: 'string',
    description: 'JSON array string of service ObjectIds, e.g. ["507f..."]',
    example: `["${OBJECT_ID}"]`,
  },
  type: { type: 'string', enum: typeValues, default: BannerType.GENERAL },
  status: { type: 'string', enum: statusValues, default: BannerStatus.INACTIVE },
  sortOrder: { type: 'integer', minimum: 0, default: 0 },
  startAt: { type: 'string', format: 'date-time', nullable: true },
  endAt: { type: 'string', format: 'date-time', nullable: true },
  platform: { type: 'string', enum: platformValues, default: BannerPlatform.ALL },
  file: {
    type: 'string',
    format: 'binary',
    description: 'Banner image (jpeg/png/webp/gif, max 5MB)',
  },
};

const filterParams = [
  {
    name: 'position',
    in: 'query',
    schema: {
      type: 'integer',
      minimum: MIN_BANNER_POSITION,
      maximum: MAX_BANNER_POSITION,
    },
  },
  {
    name: 'categoryId',
    in: 'query',
    schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
  },
  {
    name: 'serviceCategory',
    in: 'query',
    schema: { type: 'string', example: 'hair' },
  },
  {
    name: 'serviceId',
    in: 'query',
    schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
  },
  {
    name: 'platform',
    in: 'query',
    schema: { type: 'string', enum: platformValues },
  },
  {
    name: 'type',
    in: 'query',
    schema: { type: 'string', enum: typeValues },
  },
  {
    name: 'sort',
    in: 'query',
    schema: {
      type: 'string',
      default: DEFAULT_BANNER_SORT,
      enum: sortEnum,
    },
  },
];

const adminOnly =
  '**Auth:** Bearer JWT + RBAC (`banners.*`). Super Admin bypasses.';

const multipartCreate = {
  required: true,
  content: {
    'multipart/form-data': {
      schema: {
        type: 'object',
        required: ['title', 'position', 'file'],
        properties: formFields,
      },
    },
  },
};

const multipartUpdate = {
  required: true,
  content: {
    'multipart/form-data': {
      schema: {
        type: 'object',
        properties: formFields,
      },
    },
    'application/json': {
      schema: {
        type: 'object',
        minProperties: 1,
        additionalProperties: false,
        properties: Object.fromEntries(
          Object.entries(formFields).filter(([key]) => key !== 'file'),
        ),
      },
      example: {
        title: 'Summer Glow Offer — Extended',
        status: BannerStatus.ACTIVE,
      },
    },
  },
};

export const bannerDocs = {
  paths: {
    '/api/v1/banners/active': {
      get: {
        tags: ['Banners'],
        summary: 'List active banners (public)',
        description:
          'No auth. Returns ACTIVE banners in schedule window. Cached for sub-200ms reads.',
        security: publicSecurity,
        parameters: [...pageQueryParams({ page: 1, limit: 10 }), ...filterParams],
        responses: {
          ...okResponse(
            successExample([bannerExample], {
              ...paginationMeta,
              total: 1,
            }),
          ),
          ...withErrors(422, 500),
        },
      },
    },

    '/api/v1/banners': {
      get: {
        tags: ['Banners'],
        summary: 'List banners (admin)',
        description: `${adminOnly}\n\nIncludes inactive/scheduled.`,
        security: bearerSecurity,
        parameters: [
          ...pageQueryParams({ page: 1, limit: 10 }),
          ...filterParams,
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: statusValues },
          },
        ],
        responses: {
          ...okResponse(
            successExample([bannerExample], {
              ...paginationMeta,
              total: 1,
            }),
          ),
          ...withErrors(401, 403, 422, 500),
        },
      },
      post: {
        tags: ['Banners'],
        summary: 'Create banner',
        description: `${adminOnly}\n\nMultipart required. Field \`file\` uploads the banner image (max 5MB). Max ${MAX_BANNERS_PER_POSITION} active banners per position.`,
        security: bearerSecurity,
        requestBody: multipartCreate,
        responses: {
          ...createdResponse(successExample(bannerExample)),
          ...withErrors(400, 401, 403, 422, 500),
        },
      },
    },

    '/api/v1/banners/{id}': {
      get: {
        tags: ['Banners'],
        summary: 'Get banner by id',
        description: adminOnly,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Banner ObjectId')],
        responses: {
          ...okResponse(successExample(bannerExample)),
          ...withErrors(401, 403, 404, 422, 500),
        },
      },
      patch: {
        tags: ['Banners'],
        summary: 'Update banner',
        description: `${adminOnly}\n\nJSON or multipart. Optional \`file\` replaces the banner image.`,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Banner ObjectId')],
        requestBody: multipartUpdate,
        responses: {
          ...okResponse(
            successExample({
              ...bannerExample,
              title: 'Summer Glow Offer — Extended',
            }),
          ),
          ...withErrors(400, 401, 403, 404, 422, 500),
        },
      },
      delete: {
        tags: ['Banners'],
        summary: 'Soft-delete banner',
        description: adminOnly,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Banner ObjectId')],
        responses: {
          ...noContentResponse(),
          ...withErrors(401, 403, 404, 422, 500),
        },
      },
    },
  },
};
