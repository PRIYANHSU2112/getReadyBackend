import {
  bearerSecurity,
  OBJECT_ID,
  jsonBody,
  okResponse,
  withErrors,
  successExample,
} from '../../core/swagger/swagger.common.js';
import { CartItemType, BookForOthersMode } from '../../common/constants/enums.js';
import {
  MAX_CART_ITEMS,
  MAX_ITEM_QUANTITY,
  MAX_SPECIAL_INSTRUCTIONS_LENGTH,
  CART_VISIT_FEE_WAIVE_THRESHOLD,
  CART_CURRENCY,
} from '../../common/constants/cart.js';

const authOnly =
  '**Auth:** Bearer JWT required.\n\n**Access:** Own cart only (no RBAC permission keys).\n\n' +
  'Every mutation returns the full cart DTO (items + benefits + pricing).';

const pricingExample = {
  subtotal: 999,
  visitFee: 0,
  visitFeeWaived: true,
  couponDiscount: 0,
  pointsDeduction: 0,
  cashbackDeduction: 0,
  grandTotal: 999,
  savings: 100,
  earnPoints: 999,
  upsell: null,
  currency: CART_CURRENCY,
  computedAt: '2026-08-04T10:00:00.000Z',
};

const cartExample = {
  id: '64f0c2a1b4e1c2d3e4f50700',
  userId: OBJECT_ID,
  items: [
    {
      id: '64f0c2a1b4e1c2d3e4f50701',
      itemType: CartItemType.SERVICE,
      refId: '64f0c2a1b4e1c2d3e4f50710',
      quantity: 1,
      snapshot: {
        name: 'Classic facial',
        thumbnail: 'https://cdn.example.com/facial.jpg',
        durationLabel: '3-4 hrs',
        badges: ['trending'],
        unitPrice: 2999,
        mrp: 4200,
        rating: 4.8,
        homeVisitFee: 0,
        extraCharge: 0,
      },
      packageMeta: null,
      selectedServices: [],
      forMemberId: null,
      forMember: null,
      lineTotal: 2999,
    },
  ],
  itemCount: 1,
  recipients: [
    {
      memberId: null,
      name: 'Self',
      relationship: null,
      avatarUrl: null,
      itemCount: 1,
      lineIds: ['64f0c2a1b4e1c2d3e4f50701'],
    },
  ],
  specialInstructions: null,
  benefits: {
    couponCode: null,
    usePoints: false,
    useCashback: false,
    membershipOptIn: false,
    pointsBalance: 0,
    cashbackBalance: 0,
  },
  pricing: pricingExample,
  expiresAt: '2026-09-03T10:00:00.000Z',
  checkedOutAt: null,
  createdAt: '2026-08-04T10:00:00.000Z',
  updatedAt: '2026-08-04T10:00:00.000Z',
};

const lineIdParam = {
  name: 'lineId',
  in: 'path',
  required: true,
  schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
  description: 'Cart line item id',
};

const addItemSchema = {
  type: 'object',
  required: ['itemType', 'refId'],
  additionalProperties: false,
  properties: {
    itemType: {
      type: 'string',
      enum: Object.values(CartItemType),
      description: 'SERVICE = single service; PACKAGE = pack/bundle',
    },
    refId: {
      type: 'string',
      pattern: '^[a-fA-F0-9]{24}$',
      description: 'Catalog id — serviceId when itemType=SERVICE, packageId when itemType=PACKAGE',
      example: OBJECT_ID,
    },
    quantity: {
      type: 'integer',
      minimum: 1,
      maximum: MAX_ITEM_QUANTITY,
      default: 1,
      example: 1,
    },
    selectedServiceIds: {
      type: 'array',
      items: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
      description:
        'Only for PACKAGE. Ignored for SERVICE. Use real service ids from the package.',
    },
    forMemberId: {
      type: 'string',
      pattern: '^[a-fA-F0-9]{24}$',
      nullable: true,
      description: 'Member id to book for. Omit/null = Self (payer).',
    },
  },
  example: {
    itemType: CartItemType.SERVICE,
    refId: OBJECT_ID,
    quantity: 1,
  },
};

const addServiceExample = {
  itemType: CartItemType.SERVICE,
  refId: OBJECT_ID,
  quantity: 1,
};

const addServiceForMemberExample = {
  itemType: CartItemType.SERVICE,
  refId: OBJECT_ID,
  quantity: 1,
  forMemberId: '64f0c2a1b4e1c2d3e4f50801',
};

const addPackageExample = {
  itemType: CartItemType.PACKAGE,
  refId: OBJECT_ID,
  quantity: 1,
  selectedServiceIds: [OBJECT_ID],
};

export const cartDocs = {
  paths: {
    '/api/v1/cart': {
      get: {
        tags: ['Cart'],
        summary: 'Get my cart',
        description: `${authOnly}\n\nCreates an empty cart if none exists. Visit fee waiver threshold: ₹${CART_VISIT_FEE_WAIVE_THRESHOLD}. Max lines: ${MAX_CART_ITEMS}.`,
        security: bearerSecurity,
        responses: {
          ...okResponse(successExample(cartExample)),
          ...withErrors(401, 404, 422, 500),
        },
      },
      delete: {
        tags: ['Cart'],
        summary: 'Clear my cart',
        description: authOnly,
        security: bearerSecurity,
        responses: {
          ...okResponse(successExample({ ...cartExample, items: [], itemCount: 0 })),
          ...withErrors(401, 404, 422, 500),
        },
      },
    },
    '/api/v1/cart/items': {
      post: {
        tags: ['Cart'],
        summary: 'Add service or package to cart',
        description: [
          authOnly,
          '',
          '**Service body:** `{ "itemType": "SERVICE", "refId": "<serviceId>", "quantity": 1 }`',
          '',
          '**For a member (different services):** add optional `forMemberId`.',
          '',
          '**Package body:** `{ "itemType": "PACKAGE", "refId": "<packageId>", "quantity": 1, "selectedServiceIds": ["..."] }`',
          '',
          '`refId` must be a real **24-char hex** Mongo id from Services/Packages — not a placeholder like `"string"`.',
        ].join('\n'),
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: addItemSchema,
              example: addServiceExample,
              examples: {
                addService: {
                  summary: 'Add a service for Self',
                  value: addServiceExample,
                },
                addServiceForMember: {
                  summary: 'Add a service for a member',
                  value: addServiceForMemberExample,
                },
                addPackage: {
                  summary: 'Add a package',
                  value: addPackageExample,
                },
              },
            },
          },
        },
        responses: {
          ...okResponse(successExample(cartExample)),
          ...withErrors(401, 404, 422, 500),
        },
      },
    },
    '/api/v1/cart/book-for-others': {
      post: {
        tags: ['Cart'],
        summary: 'Clone Self cart lines for selected members (same services)',
        description: [
          authOnly,
          '',
          'Clones lines where `forMemberId` is null (Self) onto each selected member.',
          'For different services, browse the catalog and `POST /cart/items` with `forMemberId` instead.',
        ].join('\n'),
        security: bearerSecurity,
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['memberIds'],
            additionalProperties: false,
            properties: {
              memberIds: {
                type: 'array',
                minItems: 1,
                items: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
              },
              mode: {
                type: 'string',
                enum: Object.values(BookForOthersMode),
                default: BookForOthersMode.SAME_SERVICES,
              },
            },
          },
          {
            memberIds: ['64f0c2a1b4e1c2d3e4f50801'],
            mode: BookForOthersMode.SAME_SERVICES,
          },
        ),
        responses: {
          ...okResponse(successExample(cartExample)),
          ...withErrors(401, 404, 422, 500),
        },
      },
    },
    '/api/v1/cart/items/{lineId}': {
      patch: {
        tags: ['Cart'],
        summary: 'Update cart line quantity',
        description: `${authOnly}\n\nSet quantity to \`0\` to remove the line.`,
        security: bearerSecurity,
        parameters: [lineIdParam],
        requestBody: jsonBody({
          type: 'object',
          required: ['quantity'],
          additionalProperties: false,
          properties: {
            quantity: {
              type: 'integer',
              minimum: 0,
              maximum: MAX_ITEM_QUANTITY,
            },
          },
        }),
        responses: {
          ...okResponse(successExample(cartExample)),
          ...withErrors(401, 404, 422, 500),
        },
      },
      delete: {
        tags: ['Cart'],
        summary: 'Remove cart line',
        description: authOnly,
        security: bearerSecurity,
        parameters: [lineIdParam],
        responses: {
          ...okResponse(successExample(cartExample)),
          ...withErrors(401, 404, 422, 500),
        },
      },
    },
    '/api/v1/cart/items/{lineId}/selections': {
      patch: {
        tags: ['Cart'],
        summary: 'Update package selected services',
        description: authOnly,
        security: bearerSecurity,
        parameters: [lineIdParam],
        requestBody: jsonBody({
          type: 'object',
          required: ['selectedServiceIds'],
          additionalProperties: false,
          properties: {
            selectedServiceIds: {
              type: 'array',
              minItems: 1,
              items: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
            },
          },
        }),
        responses: {
          ...okResponse(successExample(cartExample)),
          ...withErrors(401, 404, 422, 500),
        },
      },
    },
    '/api/v1/cart/items/{lineId}/recipient': {
      patch: {
        tags: ['Cart'],
        summary: 'Assign cart line to Self or a member',
        description: `${authOnly}\n\nSet \`forMemberId\` to a member id, or \`null\` for Self.`,
        security: bearerSecurity,
        parameters: [lineIdParam],
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['forMemberId'],
            additionalProperties: false,
            properties: {
              forMemberId: {
                type: 'string',
                pattern: '^[a-fA-F0-9]{24}$',
                nullable: true,
              },
            },
          },
          { forMemberId: '64f0c2a1b4e1c2d3e4f50801' },
        ),
        responses: {
          ...okResponse(successExample(cartExample)),
          ...withErrors(401, 404, 422, 500),
        },
      },
    },
    '/api/v1/cart/instructions': {
      patch: {
        tags: ['Cart'],
        summary: 'Update special instructions',
        description: authOnly,
        security: bearerSecurity,
        requestBody: jsonBody({
          type: 'object',
          required: ['specialInstructions'],
          additionalProperties: false,
          properties: {
            specialInstructions: {
              type: 'string',
              nullable: true,
              maxLength: MAX_SPECIAL_INSTRUCTIONS_LENGTH,
            },
          },
        }),
        responses: {
          ...okResponse(successExample(cartExample)),
          ...withErrors(401, 404, 422, 500),
        },
      },
    },
    '/api/v1/cart/benefits': {
      patch: {
        tags: ['Cart'],
        summary: 'Update cart benefits',
        description:
          `${authOnly}\n\nOnly ONE benefit (Coupon Code, Points, or Cashback) can be applied to the cart at a time. ` +
          'Cashback is only available for active membership holders. Wallet is excluded from cart.',
        security: bearerSecurity,
        requestBody: jsonBody({
          type: 'object',
          additionalProperties: false,
          minProperties: 1,
          properties: {
            couponCode: {
              type: 'string',
              nullable: true,
              description: 'Set null or empty string to clear',
            },
            usePoints: { type: 'boolean' },
            useCashback: { type: 'boolean', description: 'Requires active membership' },
            membershipOptIn: { type: 'boolean' },
          },
        }),
        responses: {
          ...okResponse(successExample(cartExample)),
          ...withErrors(401, 403, 404, 409, 422, 500),
        },
      },
    },
  },
};
