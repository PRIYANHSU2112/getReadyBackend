import { BaseValidator } from '../../common/base/BaseValidator.js';
import { WalletTransactionCategory, WalletTransactionType } from './wallet.enum.js';

const { Joi } = BaseValidator;

const createTopupOrder = Joi.object({
  amount: Joi.number().greater(0).required().messages({
    'number.greater': 'Top-up amount must be greater than 0',
  }),
}).unknown(false);

const verifyTopupPayment = Joi.object({
  razorpayOrderId: Joi.string().trim().required(),
  razorpayPaymentId: Joi.string().trim().required(),
  razorpaySignature: Joi.string().trim().allow('', null).optional(),
}).unknown(false);

const addPoints = Joi.object({
  points: Joi.number().integer().positive().required(),
  description: Joi.string().trim().max(255).allow('', null).optional(),
  referenceId: Joi.string().trim().max(100).allow('', null).optional(),
}).unknown(false);

const deductPoints = Joi.object({
  points: Joi.number().integer().positive().required(),
  description: Joi.string().trim().max(255).allow('', null).optional(),
  referenceId: Joi.string().trim().max(100).allow('', null).optional(),
}).unknown(false);

const listTransactionsQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  category: Joi.string().valid(...Object.values(WalletTransactionCategory)),
  type: Joi.string().valid(...Object.values(WalletTransactionType)),
});

const updateLoyaltyRules = Joi.object({
  earnRatio: Joi.number().min(0).max(1).optional(),
  redeemRatio: Joi.number().min(0.001).max(10).optional(),
  minPointsToRedeem: Joi.number().integer().min(0).optional(),
  maxRedeemPercentage: Joi.number().min(1).max(100).optional(),
  isActive: Joi.boolean().optional(),
  description: Joi.string().trim().max(500).allow('', null).optional(),
}).min(1).unknown(false);

export class WalletValidator extends BaseValidator {
  constructor() {
    super({
      createTopupOrder,
      verifyTopupPayment,
      addPoints,
      deductPoints,
      listTransactionsQuery,
      updateLoyaltyRules,
    });
  }
}

export const walletValidator = new WalletValidator();

