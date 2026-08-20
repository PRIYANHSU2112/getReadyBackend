import {
  bearerSecurity,
  OBJECT_ID,
  paginationMeta,
  jsonBody,
  okResponse,
  createdResponse,
  withErrors,
  successExample,
  pageQueryParams,
} from '../../core/swagger/swagger.common.js';
import {
  WalletTransactionType,
  WalletTransactionCategory,
  WalletTransactionStatus,
} from './wallet.enum.js';

const authOnly = '**Auth:** Bearer JWT required.';

const walletExample = {
  id: '64f0c2a1b4e1c2d3e4f50900',
  userId: OBJECT_ID,
  balance: 1500,
  points: 450,
  cashbackBalance: 200,
  currency: 'INR',
  isActive: true,
  createdAt: '2026-08-07T10:00:00.000Z',
  updatedAt: '2026-08-07T10:00:00.000Z',
};

const walletTransactionExample = {
  id: '64f0c2a1b4e1c2d3e4f50901',
  walletId: '64f0c2a1b4e1c2d3e4f50900',
  userId: OBJECT_ID,
  type: WalletTransactionType.CREDIT,
  category: WalletTransactionCategory.TOPUP,
  status: WalletTransactionStatus.SUCCESS,
  amount: 500,
  points: 0,
  balanceAfter: 1500,
  pointsAfter: 450,
  paymentGateway: 'RAZORPAY',
  razorpayOrderId: 'order_1723020000_abc1234',
  razorpayPaymentId: 'pay_1723020000_xyz5678',
  description: 'Wallet top-up of ₹500',
  referenceId: null,
  createdAt: '2026-08-07T10:00:00.000Z',
};

const loyaltyRuleExample = {
  id: '64f0c2a1b4e1c2d3e4f50999',
  earnRatio: 0.10,
  redeemRatio: 0.10,
  minPointsToRedeem: 100,
  maxRedeemPercentage: 50,
  isActive: true,
  description: '10 Points = ₹1. Earn 10% reward points on all completed bookings.',
  updatedBy: OBJECT_ID,
  updatedAt: '2026-08-07T10:00:00.000Z',
};

export const walletDocs = {
  paths: {
    '/api/v1/wallets/loyalty-rules': {
      get: {
        tags: ['Wallet'],
        summary: 'Get platform loyalty & points conversion rules',
        description: 'Public/Client endpoint to fetch current points earn/redeem conversion rates.',
        responses: {
          ...okResponse(successExample(loyaltyRuleExample)),
          ...withErrors(500),
        },
      },
      put: {
        tags: ['Wallet'],
        summary: 'Update platform loyalty rules (Admin)',
        description: `${authOnly}\n\n**Permission:** \`wallets.update\`\n\nSets points earn/redeem rates. E.g. redeemRatio: 0.10 means 10 points = ₹1.`,
        security: bearerSecurity,
        requestBody: jsonBody({
          type: 'object',
          properties: {
            earnRatio: { type: 'number', minimum: 0, maximum: 1, example: 0.10 },
            redeemRatio: { type: 'number', minimum: 0.001, maximum: 10, example: 0.10 },
            minPointsToRedeem: { type: 'number', minimum: 0, example: 100 },
            maxRedeemPercentage: { type: 'number', minimum: 1, maximum: 100, example: 50 },
            isActive: { type: 'boolean', example: true },
            description: { type: 'string', example: '10 Points = ₹1' },
          },
        }),
        responses: {
          ...okResponse(successExample(loyaltyRuleExample)),
          ...withErrors(401, 403, 422, 500),
        },
      },
    },
    '/api/v1/wallets/me': {

      get: {
        tags: ['Wallet'],
        summary: 'Get my wallet balance and points',
        description: authOnly,
        security: bearerSecurity,
        responses: {
          ...okResponse(successExample(walletExample)),
          ...withErrors(401, 404, 500),
        },
      },
    },
    '/api/v1/wallets/topup/create-order': {
      post: {
        tags: ['Wallet'],
        summary: 'Create Razorpay wallet top-up order',
        description: authOnly,
        security: bearerSecurity,
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['amount'],
            additionalProperties: false,
            properties: {
              amount: { type: 'number', minimum: 1, example: 500 },
            },
          },
          { amount: 500 },
        ),
        responses: {
          ...createdResponse(
            successExample({
              orderId: 'order_1723020000_abc1234',
              amount: 500,
              currency: 'INR',
              razorpayKeyId: 'rzp_test_key',
              transaction: walletTransactionExample,
            }),
          ),
          ...withErrors(400, 401, 422, 500),
        },
      },
    },
    '/api/v1/wallets/topup/verify': {
      post: {
        tags: ['Wallet'],
        summary: 'Verify Razorpay payment and credit wallet',
        description: `${authOnly}\n\nUses Mongoose ACID sessions to atomically update wallet balance and log transaction.`,
        security: bearerSecurity,
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['razorpayOrderId', 'razorpayPaymentId'],
            additionalProperties: false,
            properties: {
              razorpayOrderId: { type: 'string', example: 'order_1723020000_abc1234' },
              razorpayPaymentId: { type: 'string', example: 'pay_1723020000_xyz5678' },
              razorpaySignature: { type: 'string', nullable: true, example: 'mock_sig' },
            },
          },
          {
            razorpayOrderId: 'order_1723020000_abc1234',
            razorpayPaymentId: 'pay_1723020000_xyz5678',
            razorpaySignature: 'mock_sig',
          },
        ),
        responses: {
          ...okResponse(
            successExample({
              wallet: walletExample,
              transaction: walletTransactionExample,
            }),
          ),
          ...withErrors(400, 401, 404, 422, 500),
        },
      },
    },
    '/api/v1/wallets/webhook/razorpay': {
      post: {
        tags: ['Wallet'],
        summary: 'Razorpay webhook payment notification',
        description: 'Public endpoint for Razorpay asynchronous payment capture events.',
        responses: {
          ...okResponse(successExample({ received: true })),
          ...withErrors(400, 500),
        },
      },
    },
    '/api/v1/wallets/transactions': {
      get: {
        tags: ['Wallet'],
        summary: 'List wallet transactions history',
        description: authOnly,
        security: bearerSecurity,
        parameters: [
          ...pageQueryParams({ page: 1, limit: 10 }),
          {
            name: 'category',
            in: 'query',
            schema: { type: 'string', enum: Object.values(WalletTransactionCategory) },
          },
          {
            name: 'type',
            in: 'query',
            schema: { type: 'string', enum: Object.values(WalletTransactionType) },
          },
        ],
        responses: {
          ...okResponse(
            successExample([walletTransactionExample], {
              ...paginationMeta,
              total: 1,
            }),
          ),
          ...withErrors(401, 500),
        },
      },
    },
    '/api/v1/wallets/points/add': {
      post: {
        tags: ['Wallet'],
        summary: 'Add reward points to wallet',
        description: authOnly,
        security: bearerSecurity,
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['points'],
            additionalProperties: false,
            properties: {
              points: { type: 'integer', minimum: 1, example: 100 },
              description: { type: 'string', nullable: true, example: 'Booking reward points' },
              referenceId: { type: 'string', nullable: true, example: OBJECT_ID },
            },
          },
          { points: 100, description: 'Booking reward points' },
        ),
        responses: {
          ...okResponse(
            successExample({
              wallet: walletExample,
              transaction: {
                ...walletTransactionExample,
                type: WalletTransactionType.CREDIT,
                category: WalletTransactionCategory.POINTS_EARNED,
                points: 100,
              },
            }),
          ),
          ...withErrors(400, 401, 500),
        },
      },
    },
    '/api/v1/wallets/points/deduct': {
      post: {
        tags: ['Wallet'],
        summary: 'Deduct reward points from wallet',
        description: authOnly,
        security: bearerSecurity,
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['points'],
            additionalProperties: false,
            properties: {
              points: { type: 'integer', minimum: 1, example: 50 },
              description: { type: 'string', nullable: true, example: 'Redeemed points on order' },
              referenceId: { type: 'string', nullable: true, example: OBJECT_ID },
            },
          },
          { points: 50, description: 'Redeemed points on order' },
        ),
        responses: {
          ...okResponse(
            successExample({
              wallet: walletExample,
              transaction: {
                ...walletTransactionExample,
                type: WalletTransactionType.DEBIT,
                category: WalletTransactionCategory.POINTS_REDEEMED,
                points: 50,
              },
            }),
          ),
          ...withErrors(400, 401, 422, 500),
        },
      },
    },
  },
};
