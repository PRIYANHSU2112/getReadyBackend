import {
  bearerSecurity,
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
import { AddressLabel } from '../../common/constants/enums.js';
import {
  MAX_ADDRESSES_PER_USER,
  DEFAULT_COUNTRY,
  DEFAULT_ADDRESS_SORT,
  ADDRESS_SORT_FIELDS,
  GeoJsonType,
} from '../../common/constants/address.js';

const addressLabelValues = Object.values(AddressLabel);
const sortEnum = ADDRESS_SORT_FIELDS.flatMap((field) => [field, `-${field}`]);

const addressExample = {
  id: '64f0c2a1b4e1c2d3e4f50630',
  userId: OBJECT_ID,
  label: AddressLabel.HOME,
  fullName: 'Priya Sharma',
  phone: '+919876543210',
  line1: '12 MG Road',
  line2: 'Near Metro Station',
  landmark: 'Opposite City Mall',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560001',
  country: DEFAULT_COUNTRY,
  location: { type: GeoJsonType.POINT, coordinates: [77.5946, 12.9716] },
  isDefault: true,
  deletedAt: null,
  createdAt: '2026-07-25T05:00:00.000Z',
  updatedAt: '2026-07-25T05:00:00.000Z',
};

const createSchema = {
  type: 'object',
  required: ['fullName', 'phone', 'line1', 'city', 'state', 'pincode'],
  additionalProperties: false,
  properties: {
    label: {
      type: 'string',
      enum: addressLabelValues,
      default: AddressLabel.HOME,
    },
    fullName: { type: 'string', minLength: 2, maxLength: 100, example: 'Priya Sharma' },
    phone: { type: 'string', pattern: '^\\+?[1-9]\\d{7,14}$', example: '+919876543210' },
    line1: { type: 'string', example: '12 MG Road' },
    line2: { type: 'string', nullable: true, example: 'Near Metro Station' },
    landmark: { type: 'string', nullable: true, example: 'Opposite City Mall' },
    city: { type: 'string', example: 'Bengaluru' },
    state: { type: 'string', example: 'Karnataka' },
    pincode: { type: 'string', pattern: '^\\d{6}$', example: '560001' },
    country: { type: 'string', default: DEFAULT_COUNTRY, example: DEFAULT_COUNTRY },
    lat: { type: 'number', minimum: -90, maximum: 90, example: 12.9716 },
    lng: { type: 'number', minimum: -180, maximum: 180, example: 77.5946 },
    isDefault: { type: 'boolean', example: true },
  },
};

const authOnly =
  '**Auth:** Bearer JWT required.\n\n**Access:** Own addresses only (no RBAC permission keys).';

export const addressDocs = {
  paths: {
    '/api/v1/addresses': {
      get: {
        tags: ['Addresses'],
        summary: 'List my addresses',
        description: authOnly,
        security: bearerSecurity,
        parameters: [
          ...pageQueryParams({ page: 1, limit: 10 }),
          {
            name: 'sort',
            in: 'query',
            schema: {
              type: 'string',
              default: DEFAULT_ADDRESS_SORT,
              enum: sortEnum,
            },
          },
        ],
        responses: {
          ...okResponse(
            successExample([addressExample], {
              ...paginationMeta,
              total: 1,
            }),
          ),
          ...withErrors(401, 422, 500),
        },
      },
      post: {
        tags: ['Addresses'],
        summary: 'Create my address',
        description: `${authOnly}\n\nMax ${MAX_ADDRESSES_PER_USER} active addresses. First address becomes default automatically.`,
        security: bearerSecurity,
        requestBody: jsonBody(createSchema, {
          label: AddressLabel.HOME,
          fullName: 'Priya Sharma',
          phone: '+919876543210',
          line1: '12 MG Road',
          line2: 'Near Metro Station',
          landmark: 'Opposite City Mall',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
          country: DEFAULT_COUNTRY,
          lat: 12.9716,
          lng: 77.5946,
          isDefault: true,
        }),
        responses: {
          ...createdResponse(successExample(addressExample)),
          ...withErrors(400, 401, 422, 500),
        },
      },
    },

    '/api/v1/addresses/{id}': {
      get: {
        tags: ['Addresses'],
        summary: 'Get my address by id',
        description: authOnly,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Address ObjectId')],
        responses: {
          ...okResponse(successExample(addressExample)),
          ...withErrors(401, 404, 422, 500),
        },
      },
      patch: {
        tags: ['Addresses'],
        summary: 'Update my address',
        description: authOnly,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Address ObjectId')],
        requestBody: jsonBody(
          {
            type: 'object',
            minProperties: 1,
            additionalProperties: false,
            properties: createSchema.properties,
          },
          { line1: '14 MG Road', landmark: 'Beside Cafe' },
        ),
        responses: {
          ...okResponse(successExample({ ...addressExample, line1: '14 MG Road' })),
          ...withErrors(400, 401, 404, 422, 500),
        },
      },
      delete: {
        tags: ['Addresses'],
        summary: 'Soft-delete my address',
        description: `${authOnly}\n\nIf the deleted address was default, the newest remaining address becomes default.`,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Address ObjectId')],
        responses: {
          ...noContentResponse(),
          ...withErrors(401, 404, 422, 500),
        },
      },
    },

    '/api/v1/addresses/{id}/default': {
      put: {
        tags: ['Addresses'],
        summary: 'Set address as default',
        description: authOnly,
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Address ObjectId')],
        responses: {
          ...okResponse(successExample({ ...addressExample, isDefault: true })),
          ...withErrors(401, 404, 422, 500),
        },
      },
    },
  },
};
