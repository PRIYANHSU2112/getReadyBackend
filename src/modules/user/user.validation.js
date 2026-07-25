import { BaseValidator } from '../../common/base/BaseValidator.js';
import { UserRole, Gender } from '../../common/constants/enums.js';

const { Joi } = BaseValidator;

const objectId = Joi.string().hex().length(24);

const emailSchema = Joi.string().email({ tlds: { allow: false } });

const roleSlug = Joi.string()
  .lowercase()
  .trim()
  .pattern(/^[a-z][a-z0-9_]{1,49}$/);

const profileImageSchema = Joi.object({
  url: Joi.string().uri().allow('', null),
  publicId: Joi.string().allow('', null),
});

const createUser = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: emailSchema.when('role', {
    is: Joi.valid(UserRole.ADMIN, UserRole.SUPER_ADMIN),
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{7,14}$/)
    .when('role', {
      is: Joi.valid(UserRole.CUSTOMER, UserRole.BEAUTICIAN),
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  password: Joi.string().min(8).max(128).when('role', {
    is: Joi.valid(UserRole.ADMIN, UserRole.SUPER_ADMIN),
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  role: roleSlug.default(UserRole.CUSTOMER),
  profileImage: profileImageSchema.optional(),
  gender: Joi.string()
    .valid(...Object.values(Gender))
    .optional(),
  dob: Joi.date().max('now').optional(),
  referralCode: Joi.string().uppercase().trim().min(4).max(32).optional(),
  fcmToken: Joi.string().max(512).optional(),
});

const updateUser = Joi.object({
  name: Joi.string().min(2).max(100),
  email: emailSchema,
  phone: Joi.string().pattern(/^\+?[1-9]\d{7,14}$/),
  password: Joi.string().min(8).max(128),
  role: roleSlug,
  isActive: Joi.boolean().truthy('true').falsy('false'),
  gender: Joi.string()
    .valid(...Object.values(Gender))
    .allow(null, ''),
  dob: Joi.date().max('now').allow(null, ''),
  fcmToken: Joi.string().max(512).allow(null, ''),
}).min(1);

const updateMe = Joi.object({
  name: Joi.string().min(2).max(100),
  gender: Joi.string()
    .valid(...Object.values(Gender))
    .allow(null, ''),
  dob: Joi.date().max('now').allow(null, ''),
  fcmToken: Joi.string().max(512).allow(null, ''),
}).min(1);

const getUserParams = Joi.object({
  id: objectId.required(),
});

const listUsersQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string().default('-createdAt'),
  search: Joi.string().allow('').optional(),
  role: roleSlug.optional(),
  isActive: Joi.boolean().optional(),
  gender: Joi.string()
    .valid(...Object.values(Gender))
    .optional(),
  createdFrom: Joi.date().iso().optional(),
  createdTo: Joi.date().iso().optional(),
  hasReferral: Joi.boolean().optional(),
});

export class UserValidator extends BaseValidator {
  constructor() {
    super({
      createUser,
      updateUser,
      updateMe,
      getUserParams,
      listUsersQuery,
    });
  }
}

export const userValidator = new UserValidator();
