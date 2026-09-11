import Joi from 'joi';

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/).message('Invalid ObjectId');

export const walletValidator = {
  createTopupOrder: Joi.object({
    amount: Joi.number().positive().min(1).max(50000).required(),
  }),

  verifyTopupPayment: Joi.object({
    orderId: Joi.string().required(),
    paymentId: Joi.string().required(),
    signature: Joi.string().allow('', null).optional(),
  }),

  creditDebitWallet: Joi.object({
    userId: objectId.required(),
    amount: Joi.number().positive().required(),
    category: Joi.string().optional(),
    referenceId: Joi.string().allow('', null).optional(),
    description: Joi.string().max(255).allow('', null).optional(),
  }),

  addPoints: Joi.object({
    points: Joi.number().integer().positive().required(),
    reason: Joi.string().max(255).optional(),
    referenceId: Joi.string().optional(),
  }),

  deductPoints: Joi.object({
    points: Joi.number().integer().positive().required(),
    reason: Joi.string().max(255).optional(),
    referenceId: Joi.string().optional(),
  }),

  listTransactionsQuery: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(20),
    page: Joi.number().integer().min(1).default(1),
    type: Joi.string().valid('CREDIT', 'DEBIT').optional(),
  }),

  updateLoyaltyRules: Joi.object({
    earnRatio: Joi.number().min(0).max(1).optional(),
    redeemRatio: Joi.number().min(0).max(1).optional(),
    minPointsToRedeem: Joi.number().integer().min(0).optional(),
    maxRedeemPercentage: Joi.number().min(0).max(100).optional(),
    isActive: Joi.boolean().optional(),
  }),
};
