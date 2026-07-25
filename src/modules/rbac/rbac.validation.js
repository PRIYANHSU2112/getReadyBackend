import { BaseValidator } from '../../common/base/BaseValidator.js';

const { Joi } = BaseValidator;

const objectId = Joi.string().hex().length(24);
const slug = Joi.string()
  .lowercase()
  .trim()
  .pattern(/^[a-z][a-z0-9_]{1,49}$/)
  .messages({
    'string.pattern.base':
      'slug must start with a letter and contain only lowercase letters, numbers, or underscores',
  });

const createRole = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  slug: slug.required(),
  description: Joi.string().max(500).allow('', null).optional(),
  permissions: Joi.array().items(Joi.string().trim().min(1)).default([]),
  isActive: Joi.boolean().default(true),
});

const updateRole = Joi.object({
  name: Joi.string().min(2).max(100),
  slug,
  description: Joi.string().max(500).allow('', null),
  permissions: Joi.array().items(Joi.string().trim().min(1)),
  isActive: Joi.boolean(),
}).min(1);

const setRolePermissions = Joi.object({
  permissions: Joi.array().items(Joi.string().trim().min(1)).required(),
});

const roleIdParams = Joi.object({
  id: objectId.required(),
});

const listRolesQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string().default('name'),
  search: Joi.string().allow('').optional(),
  isActive: Joi.boolean().optional(),
  isSystem: Joi.boolean().optional(),
});

const listPermissionsQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  sort: Joi.string().default('module'),
  module: Joi.string().optional(),
  isActive: Joi.boolean().optional(),
});

export class RbacValidator extends BaseValidator {
  constructor() {
    super({
      createRole,
      updateRole,
      setRolePermissions,
      roleIdParams,
      listRolesQuery,
      listPermissionsQuery,
    });
  }
}

export const rbacValidator = new RbacValidator();
