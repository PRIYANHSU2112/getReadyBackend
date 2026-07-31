import { BaseValidator } from '../../common/base/BaseValidator.js';
import {
  DEFAULT_SKILL_SORT,
  MAX_SKILL_NAME_LENGTH,
} from '../../common/constants/skill.js';

const { Joi } = BaseValidator;

const objectId = Joi.string().hex().length(24);
const boolField = Joi.boolean().truthy('true').falsy('false');

const createSkill = Joi.object({
  name: Joi.string().trim().min(1).max(MAX_SKILL_NAME_LENGTH).required(),
  categoryId: objectId.optional().allow(null),
  icon: Joi.string().trim().max(2000).optional().allow(null, ''),
  isActive: boolField.default(true),
  displayOrder: Joi.number().integer().min(0).default(0),
});

const updateSkill = Joi.object({
  name: Joi.string().trim().min(1).max(MAX_SKILL_NAME_LENGTH),
  categoryId: objectId.optional().allow(null),
  icon: Joi.string().trim().max(2000).optional().allow(null, ''),
  isActive: boolField,
  displayOrder: Joi.number().integer().min(0),
}).min(1);

const skillIdParams = Joi.object({
  id: objectId.required(),
});

const listSkillsQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string().default(DEFAULT_SKILL_SORT),
  search: Joi.string().trim().max(100).allow(''),
  categoryId: objectId.optional(),
  isActive: boolField,
  includeDeleted: boolField.default(false),
});

const publicSkillsQuery = Joi.object({
  categoryId: objectId.optional(),
});

export class SkillValidator extends BaseValidator {
  constructor() {
    super({
      createSkill,
      updateSkill,
      skillIdParams,
      listSkillsQuery,
      publicSkillsQuery,
    });
  }
}

export const skillValidator = new SkillValidator();
