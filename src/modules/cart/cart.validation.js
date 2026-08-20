import { BaseValidator } from '../../common/base/BaseValidator.js';
import { CartItemType, BookForOthersMode } from '../../common/constants/enums.js';
import {
  MAX_ITEM_QUANTITY,
  MAX_SPECIAL_INSTRUCTIONS_LENGTH,
} from '../../common/constants/cart.js';

const { Joi } = BaseValidator;

/** Mongo ObjectId — accepts mixed case; normalizes to lowercase. */
const objectId = Joi.string().trim().lowercase().hex().length(24).messages({
  'string.hex': 'must be a valid 24-character Mongo ObjectId (hex)',
  'string.length': 'must be a valid 24-character Mongo ObjectId (hex)',
});

const addCartItem = Joi.object({
  itemType: Joi.string()
    .valid(...Object.values(CartItemType))
    .required(),
  refId: objectId.required(),
  quantity: Joi.number().integer().min(1).max(MAX_ITEM_QUANTITY).default(1),
  forMemberId: objectId.allow(null).optional(),
  // Swagger often sends this for SERVICE too — strip instead of 4xx
  selectedServiceIds: Joi.when('itemType', {
    is: CartItemType.PACKAGE,
    then: Joi.array().items(objectId).default([]),
    otherwise: Joi.any().strip(),
  }),
}).unknown(false);

const updateCartItemQuantity = Joi.object({
  quantity: Joi.number().integer().min(0).max(MAX_ITEM_QUANTITY).required(),
}).unknown(false);

const updatePackageSelections = Joi.object({
  selectedServiceIds: Joi.array().items(objectId).min(1).required(),
}).unknown(false);

const updateInstructions = Joi.object({
  specialInstructions: Joi.string()
    .trim()
    .max(MAX_SPECIAL_INSTRUCTIONS_LENGTH)
    .allow('', null)
    .required(),
}).unknown(false);

const updateBenefits = Joi.object({
  couponCode: Joi.string().trim().uppercase().max(40).allow('', null),
  usePoints: Joi.boolean(),
  useCashback: Joi.boolean(),
  membershipOptIn: Joi.boolean(),
})
  .min(1)
  .unknown(false);

const updateRecipient = Joi.object({
  forMemberId: objectId.allow(null).required(),
}).unknown(false);

const bookForOthers = Joi.object({
  memberIds: Joi.array().items(objectId).min(1).max(10).required(),
  mode: Joi.string()
    .valid(...Object.values(BookForOthersMode))
    .default(BookForOthersMode.SAME_SERVICES),
}).unknown(false);

const updateHygieneKit = Joi.object({
  count: Joi.number().integer().min(1).max(20).optional(),
  quantity: Joi.number().integer().min(1).max(20).optional(),
  hygieneKitId: objectId.allow(null).optional(),
}).or('count', 'quantity').unknown(false);

const syncCartItem = Joi.object({
  itemType: Joi.string()
    .valid(...Object.values(CartItemType))
    .required(),
  refId: objectId.required(),
  quantity: Joi.number().integer().min(1).max(MAX_ITEM_QUANTITY).default(1),
  forMemberId: objectId.allow(null).optional(),
  selectedServiceIds: Joi.array().items(objectId).default([]),
}).unknown(false);

const syncCart = Joi.object({
  items: Joi.array().items(syncCartItem).max(50).default([]),
  hygieneKit: Joi.object({
    count: Joi.number().integer().min(1).max(20).optional(),
    quantity: Joi.number().integer().min(1).max(20).optional(),
    hygieneKitId: objectId.allow(null).optional(),
  }).optional(),

  benefits: Joi.object({
    couponCode: Joi.string().trim().uppercase().max(40).allow('', null),
    usePoints: Joi.boolean(),
    useCashback: Joi.boolean(),
    membershipOptIn: Joi.boolean(),
  }).optional(),
  specialInstructions: Joi.string()
    .trim()
    .max(MAX_SPECIAL_INSTRUCTIONS_LENGTH)
    .allow('', null)
    .optional(),
}).unknown(false);

const lineIdParams = Joi.object({
  lineId: objectId.required(),
});

export class CartValidator extends BaseValidator {
  constructor() {
    super({
      addCartItem,
      updateCartItemQuantity,
      updateHygieneKit,
      syncCart,
      updatePackageSelections,
      updateInstructions,
      updateBenefits,
      updateRecipient,
      bookForOthers,
      lineIdParams,
    });
  }
}

export const cartValidator = new CartValidator();

