import Joi from 'joi';

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/).message('Invalid ObjectId');

export const paymentValidator = {
  createOrder: Joi.object({
    bookingId: objectId.allow(null, '').optional(),
    amount: Joi.number().positive().required(),
    currency: Joi.string().default('INR').optional(),
    idempotencyKey: Joi.string().allow('', null).optional(),
    metadata: Joi.object().optional(),
  }),

  verifyPayment: Joi.object({
    orderId: Joi.string().required(),
    paymentId: Joi.string().required(),
    signature: Joi.string().allow('', null).optional(),
  }),

  refundPayment: Joi.object({
    amount: Joi.number().positive().optional(),
    reason: Joi.string().max(255).allow('', null).optional(),
  }),
};
