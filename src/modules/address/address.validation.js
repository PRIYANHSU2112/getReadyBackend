import { BaseValidator } from '../../common/base/BaseValidator.js';
import { AddressLabel } from '../../common/constants/enums.js';
import {
  DEFAULT_COUNTRY,
  DEFAULT_ADDRESS_SORT,
} from '../../common/constants/address.js';

const { Joi } = BaseValidator;

const objectId = Joi.string().hex().length(24);

const phoneSchema = Joi.string().pattern(/^\+?[1-9]\d{7,14}$/);

const createAddress = Joi.object({
  label: Joi.string()
    .valid(...Object.values(AddressLabel))
    .default(AddressLabel.HOME),
  fullName: Joi.string().trim().min(2).max(100).required(),
  phone: phoneSchema.required(),
  line1: Joi.string().trim().min(3).max(200).required(),
  line2: Joi.string().trim().max(200).allow('', null).optional(),
  landmark: Joi.string().trim().max(200).allow('', null).optional(),
  city: Joi.string().trim().min(2).max(100).required(),
  state: Joi.string().trim().min(2).max(100).required(),
  pincode: Joi.string().pattern(/^\d{6}$/).required(),
  country: Joi.string().trim().length(2).uppercase().default(DEFAULT_COUNTRY),
  lat: Joi.number().min(-90).max(90).optional(),
  lng: Joi.number().min(-180).max(180).optional(),
  isDefault: Joi.boolean().optional(),
}).and('lat', 'lng');

const updateAddress = Joi.object({
  label: Joi.string().valid(...Object.values(AddressLabel)),
  fullName: Joi.string().trim().min(2).max(100),
  phone: phoneSchema,
  line1: Joi.string().trim().min(3).max(200),
  line2: Joi.string().trim().max(200).allow('', null),
  landmark: Joi.string().trim().max(200).allow('', null),
  city: Joi.string().trim().min(2).max(100),
  state: Joi.string().trim().min(2).max(100),
  pincode: Joi.string().pattern(/^\d{6}$/),
  country: Joi.string().trim().length(2).uppercase(),
  lat: Joi.number().min(-90).max(90),
  lng: Joi.number().min(-180).max(180),
  isDefault: Joi.boolean(),
})
  .min(1)
  .and('lat', 'lng');

const addressIdParams = Joi.object({
  id: objectId.required(),
});

const listAddressesQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string().default(DEFAULT_ADDRESS_SORT),
});

export class AddressValidator extends BaseValidator {
  constructor() {
    super({
      createAddress,
      updateAddress,
      addressIdParams,
      listAddressesQuery,
    });
  }
}

export const addressValidator = new AddressValidator();
