import { BaseValidator } from '../../common/base/BaseValidator.js';
import { HygieneKitStatus } from '../../common/constants/enums.js';
import {
  MAX_HYGIENE_KIT_TITLE_LENGTH,
  MAX_HYGIENE_KIT_CODE_LENGTH,
  MAX_HYGIENE_KIT_DESCRIPTION_LENGTH,
  MIN_HYGIENE_KIT_PRICE,
  MAX_HYGIENE_KIT_PRICE,
  MAX_HYGIENE_KIT_INCLUDED_ITEMS,
  HYGIENE_KIT_SORT_FIELDS,
} from '../../common/constants/hygiene-kit.js';

const { Joi } = BaseValidator;

const objectId = Joi.string().hex().length(24);

const includedItemSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  quantity: Joi.number().integer().min(1).max(100).default(1),
  icon: Joi.string().trim().max(100).allow('', null).optional(),
  description: Joi.string().trim().max(250).allow('', null).optional(),
});

const includedItemsField = Joi.alternatives().try(
  Joi.array().items(Joi.alternatives().try(includedItemSchema, Joi.string().trim().min(1))).max(MAX_HYGIENE_KIT_INCLUDED_ITEMS),
  Joi.string().allow(''),
);

const createHygieneKit = Joi.object({
  title: Joi.string().trim().min(1).max(MAX_HYGIENE_KIT_TITLE_LENGTH).required(),
  code: Joi.string().trim().max(MAX_HYGIENE_KIT_CODE_LENGTH).allow('', null).optional(),
  price: Joi.number().min(MIN_HYGIENE_KIT_PRICE).max(MAX_HYGIENE_KIT_PRICE).default(49),
  description: Joi.string().trim().max(MAX_HYGIENE_KIT_DESCRIPTION_LENGTH).allow('', null).optional(),
  includedItems: includedItemsField.optional(),
  isDefault: Joi.boolean().default(false),
  isRequired: Joi.boolean().default(true),
  minQuantity: Joi.number().integer().min(1).max(10).default(1),
  maxQuantity: Joi.number().integer().min(1).max(50).default(10),
  status: Joi.string().valid(...Object.values(HygieneKitStatus)).default(HygieneKitStatus.ACTIVE),
  sortOrder: Joi.number().integer().min(0).default(0),
});

const updateHygieneKit = Joi.object({
  title: Joi.string().trim().min(1).max(MAX_HYGIENE_KIT_TITLE_LENGTH),
  code: Joi.string().trim().max(MAX_HYGIENE_KIT_CODE_LENGTH).allow('', null),
  price: Joi.number().min(MIN_HYGIENE_KIT_PRICE).max(MAX_HYGIENE_KIT_PRICE),
  description: Joi.string().trim().max(MAX_HYGIENE_KIT_DESCRIPTION_LENGTH).allow('', null),
  includedItems: includedItemsField,
  isDefault: Joi.boolean(),
  isRequired: Joi.boolean(),
  minQuantity: Joi.number().integer().min(1).max(10),
  maxQuantity: Joi.number().integer().min(1).max(50),
  status: Joi.string().valid(...Object.values(HygieneKitStatus)),
  sortOrder: Joi.number().integer().min(0),
});

const kitIdParams = Joi.object({
  id: objectId.required(),
});

const statusBody = Joi.object({
  status: Joi.string().valid(...Object.values(HygieneKitStatus)).required(),
});

const listHygieneKitsQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string().trim().default('sortOrder'),
  status: Joi.string().valid(...Object.values(HygieneKitStatus)).optional(),
  isDefault: Joi.boolean().optional(),
  search: Joi.string().trim().max(100).allow('').optional(),
});

const activeHygieneKitsQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
  sort: Joi.string().trim().default('sortOrder'),
});

export const hygieneKitValidator = {
  createHygieneKit,
  updateHygieneKit,
  kitIdParams,
  statusBody,
  listHygieneKitsQuery,
  activeHygieneKitsQuery,
};
