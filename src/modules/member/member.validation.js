import { BaseValidator } from '../../common/base/BaseValidator.js';
import { MemberRelationship, MemberSkinType } from '../../common/constants/enums.js';
import {
  MAX_MEMBER_NAME_LENGTH,
  MAX_MEDICAL_NOTES_LENGTH,
  DEFAULT_MEMBER_SORT,
} from '../../common/constants/member.js';

const { Joi } = BaseValidator;

const objectId = Joi.string().trim().lowercase().hex().length(24);

const phoneSchema = Joi.string().pattern(/^\+?[1-9]\d{7,14}$/).allow(null, '');

const createMember = Joi.object({
  name: Joi.string().trim().min(2).max(MAX_MEMBER_NAME_LENGTH).required(),
  relationship: Joi.string()
    .valid(...Object.values(MemberRelationship))
    .required(),
  age: Joi.number().integer().min(1).max(120).allow(null).optional(),
  phone: phoneSchema.optional(),
  avatarUrl: Joi.string().trim().uri().max(500).allow(null, '').optional(),
  skinType: Joi.string()
    .valid(...Object.values(MemberSkinType))
    .allow(null, '')
    .optional(),
  medicalNotes: Joi.string()
    .trim()
    .max(MAX_MEDICAL_NOTES_LENGTH)
    .allow(null, '')
    .optional(),
}).unknown(false);

const updateMember = Joi.object({
  name: Joi.string().trim().min(2).max(MAX_MEMBER_NAME_LENGTH),
  relationship: Joi.string().valid(...Object.values(MemberRelationship)),
  age: Joi.number().integer().min(1).max(120).allow(null),
  phone: phoneSchema,
  avatarUrl: Joi.string().trim().uri().max(500).allow(null, ''),
  skinType: Joi.string()
    .valid(...Object.values(MemberSkinType))
    .allow(null, ''),
  medicalNotes: Joi.string().trim().max(MAX_MEDICAL_NOTES_LENGTH).allow(null, ''),
})
  .min(1)
  .unknown(false);

const memberIdParams = Joi.object({
  id: objectId.required(),
});

const listMembersQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string().default(DEFAULT_MEMBER_SORT),
});

export class MemberValidator extends BaseValidator {
  constructor() {
    super({
      createMember,
      updateMember,
      memberIdParams,
      listMembersQuery,
    });
  }
}

export const memberValidator = new MemberValidator();
