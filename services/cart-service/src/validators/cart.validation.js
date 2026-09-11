import Joi from 'joi';

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/).message('Invalid ObjectId');

export const cartValidator = {
  addCartItem: Joi.object({
    itemType: Joi.string().valid('SERVICE', 'PACKAGE').required(),
    refId: objectId.required(),
    quantity: Joi.number().integer().min(1).max(10).default(1),
    forMemberId: objectId.allow(null, '').optional(),
    selectedServiceIds: Joi.array().items(objectId).optional(),
  }),

  updateCartItemQuantity: Joi.object({
    quantity: Joi.number().integer().min(0).max(10).required(),
  }),

  lineIdParams: Joi.object({
    lineId: Joi.string().required(),
  }),

  updateHygieneKit: Joi.object({
    count: Joi.number().integer().min(1).max(20).required(),
  }),

  updateInstructions: Joi.object({
    specialInstructions: Joi.string().max(500).allow('', null).required(),
  }),

  updateBenefits: Joi.object({
    couponCode: Joi.string().max(50).allow('', null).optional(),
    usePoints: Joi.boolean().optional(),
    useCashback: Joi.boolean().optional(),
    membershipOptIn: Joi.boolean().optional(),
  }),

  syncCart: Joi.object({
    items: Joi.array().items(
      Joi.object({
        itemType: Joi.string().valid('SERVICE', 'PACKAGE').required(),
        refId: objectId.required(),
        quantity: Joi.number().integer().min(1).max(10).default(1),
        forMemberId: objectId.allow(null, '').optional(),
      }),
    ).required(),
  }),

  bookForOthers: Joi.object({
    mode: Joi.string().valid('SELF', 'MEMBER', 'CUSTOM').optional(),
    memberId: objectId.allow(null, '').optional(),
  }),

  updatePackageSelections: Joi.object({
    selectedServices: Joi.array().items(
      Joi.object({
        serviceId: objectId.required(),
        name: Joi.string().required(),
        durationMin: Joi.number().optional().allow(null),
      }),
    ).required(),
  }),

  updateRecipient: Joi.object({
    forMemberId: objectId.allow(null, '').optional(),
  }),
};
