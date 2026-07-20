import { BaseValidator } from '../../common/base/BaseValidator.js';
import { UserRole } from '../../common/constants/enums.js';

const { Joi } = BaseValidator;

const objectId = Joi.string().hex().length(24);

const createUser = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
  role: Joi.string()
    .valid(...Object.values(UserRole))
    .default(UserRole.USER),
});

const updateUser = Joi.object({
  name: Joi.string().min(2).max(100),
  email: Joi.string().email(),
  password: Joi.string().min(8).max(128),
  role: Joi.string().valid(...Object.values(UserRole)),
  isActive: Joi.boolean(),
}).min(1);

const getUserParams = Joi.object({
  id: objectId.required(),
});

const listUsersQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string().default('-createdAt'),
  search: Joi.string().allow('').optional(),
});

const loginUser = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export class UserValidator extends BaseValidator {
  constructor() {
    super({
      createUser,
      updateUser,
      getUserParams,
      listUsersQuery,
      loginUser,
    });
  }
}

export const userValidator = new UserValidator();
