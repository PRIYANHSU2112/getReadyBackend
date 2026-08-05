import {
  bearerSecurity,
  publicSecurity,
  jsonBody,
  okResponse,
  createdResponse,
  withErrors,
  successExample,
  pageQueryParams,
} from '../../core/swagger/swagger.common.js';
import { SlotStatus, SlotAvailability } from '../../common/constants/enums.js';
import { MAX_SLOT_BULK_CREATE } from '../../common/constants/slot.js';

const adminOnly =
  '**Auth:** Bearer JWT + RBAC `slots.*`.\n\nAdmin manages concrete bookable time windows.';

const slotExample = {
  id: '64f0c2a1b4e1c2d3e4f50901',
  beauticianId: null,
  serviceIds: [],
  date: '2026-08-10',
  startAt: '2026-08-10T09:00:00.000Z',
  endAt: '2026-08-10T09:45:00.000Z',
  minBookings: 1,
  maxBookings: 1,
  bookedCount: 0,
  heldCount: 0,
  remaining: 1,
  availability: SlotAvailability.AVAILABLE,
  status: SlotStatus.ACTIVE,
  isBookable: true,
  notes: null,
  createdAt: '2026-08-05T10:00:00.000Z',
  updatedAt: '2026-08-05T10:00:00.000Z',
};

/** OpenAPI date = YYYY-MM-DD; date-time = ISO-8601 with timezone. */
const dateSchema = {
  type: 'string',
  format: 'date',
  pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  example: '2026-08-10',
  description: 'Business calendar date in YYYY-MM-DD (e.g. 2026-08-10)',
};

const dateTimeSchema = (example) => ({
  type: 'string',
  format: 'date-time',
  example,
  description: 'ISO-8601 UTC datetime (YYYY-MM-DDTHH:mm:ss.sssZ)',
});

const createBody = {
  type: 'object',
  required: ['date', 'startAt', 'endAt'],
  additionalProperties: false,
  properties: {
    date: dateSchema,
    startAt: dateTimeSchema('2026-08-10T09:00:00.000Z'),
    endAt: dateTimeSchema('2026-08-10T09:45:00.000Z'),
    minBookings: { type: 'integer', minimum: 1, default: 1 },
    maxBookings: { type: 'integer', minimum: 1, default: 1 },
    beauticianId: { type: 'string', nullable: true, pattern: '^[a-fA-F0-9]{24}$' },
    serviceIds: { type: 'array', items: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } },
    status: { type: 'string', enum: Object.values(SlotStatus) },
    isBookable: { type: 'boolean', default: true },
    notes: { type: 'string', nullable: true },
  },
  example: {
    date: '2026-08-10',
    startAt: '2026-08-10T09:00:00.000Z',
    endAt: '2026-08-10T09:45:00.000Z',
    minBookings: 1,
    maxBookings: 1,
  },
};

export const slotDocs = {
  paths: {
    '/api/v1/slots/available': {
      get: {
        tags: ['Slots'],
        summary: 'List slots for a date (AVAILABLE / FULL)',
        description:
          '**Public.** Query by `date` only (`YYYY-MM-DD`). Returns every non-cancelled slot that day with `AVAILABLE` or `FULL`. Soft-hold/confirm will be done by the Booking + payment APIs (not here).',
        security: publicSecurity,
        parameters: [
          {
            name: 'date',
            in: 'query',
            required: true,
            description: 'Business date — must be YYYY-MM-DD (example: 2026-08-10)',
            schema: dateSchema,
            example: '2026-08-10',
          },
        ],
        responses: {
          ...okResponse(successExample([slotExample, { ...slotExample, availability: SlotAvailability.FULL, remaining: 0, heldCount: 1 }])),
          ...withErrors(400, 422, 500),
        },
      },
    },
    '/api/v1/slots': {
      get: {
        tags: ['Slots'],
        summary: 'Admin list slots',
        description: adminOnly,
        security: bearerSecurity,
        parameters: [
          ...pageQueryParams({ page: 1, limit: 20 }),
          {
            name: 'date',
            in: 'query',
            description: 'Filter by business date YYYY-MM-DD',
            schema: dateSchema,
            example: '2026-08-10',
          },
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: Object.values(SlotStatus) },
          },
        ],
        responses: {
          ...okResponse(successExample([slotExample], { total: 1, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false })),
          ...withErrors(401, 403, 422, 500),
        },
      },
      post: {
        tags: ['Slots'],
        summary: 'Admin create slot',
        description: adminOnly,
        security: bearerSecurity,
        requestBody: jsonBody(createBody, createBody.example),
        responses: {
          ...createdResponse(successExample(slotExample)),
          ...withErrors(400, 401, 403, 422, 500),
        },
      },
    },
    '/api/v1/slots/bulk': {
      post: {
        tags: ['Slots'],
        summary: 'Admin bulk create slots',
        description: `${adminOnly}\n\nMax ${MAX_SLOT_BULK_CREATE} slots per request.`,
        security: bearerSecurity,
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['slots'],
            properties: {
              slots: { type: 'array', items: createBody, minItems: 1, maxItems: MAX_SLOT_BULK_CREATE },
            },
          },
          { slots: [createBody.example] },
        ),
        responses: {
          ...createdResponse(successExample([slotExample])),
          ...withErrors(400, 401, 403, 422, 500),
        },
      },
    },
    '/api/v1/slots/{id}': {
      get: {
        tags: ['Slots'],
        summary: 'Admin get slot by id',
        description: adminOnly,
        security: bearerSecurity,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          },
        ],
        responses: {
          ...okResponse(successExample(slotExample)),
          ...withErrors(401, 403, 404, 500),
        },
      },
      patch: {
        tags: ['Slots'],
        summary: 'Admin update slot',
        description: `${adminOnly}\n\nCannot set maxBookings below bookedCount.`,
        security: bearerSecurity,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          },
        ],
        requestBody: jsonBody({
          type: 'object',
          additionalProperties: false,
          minProperties: 1,
          properties: createBody.properties,
        }),
        responses: {
          ...okResponse(successExample(slotExample)),
          ...withErrors(400, 401, 403, 404, 422, 500),
        },
      },
      delete: {
        tags: ['Slots'],
        summary: 'Admin cancel slot',
        description: `${adminOnly}\n\nSoft-cancels (status=CANCELLED, isBookable=false).`,
        security: bearerSecurity,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          },
        ],
        responses: {
          ...okResponse(successExample({ ...slotExample, status: SlotStatus.CANCELLED, isBookable: false, availability: SlotAvailability.FULL })),
          ...withErrors(401, 403, 404, 500),
        },
      },
    },
  },
};
