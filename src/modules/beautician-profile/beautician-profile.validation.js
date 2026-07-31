import { BaseValidator } from '../../common/base/BaseValidator.js';
import { BeauticianProfileStatus, KycStatus, CertificateStatus } from '../../common/constants/enums.js';
import {
  DEFAULT_BEAUTICIAN_PROFILE_SORT,
  MAX_BIO_LENGTH,
  MAX_LANGUAGES,
  MAX_SKILLS,
  MAX_CERTIFICATE_TITLE_LENGTH,
  MAX_SALON_NAME_LENGTH,
  MAX_ROLE_LENGTH,
  VALID_DAYS,
} from '../../common/constants/beautician-profile.js';

const { Joi } = BaseValidator;

const objectId = Joi.string().hex().length(24);
const boolField = Joi.boolean().truthy('true').falsy('false');

const preferredHoursSchema = Joi.object({
  startTime: Joi.string().trim().pattern(/^([01]\d|2[0-3]):?([0-5]\d)$/).optional().allow(null, ''),
  endTime: Joi.string().trim().pattern(/^([01]\d|2[0-3]):?([0-5]\d)$/).optional().allow(null, ''),
  days: Joi.array().items(Joi.string().trim().lowercase().valid(...VALID_DAYS)).optional(),
});

// ── Beautician Profile ────────────────────────────────────────

const createProfile = Joi.object({
  languages: Joi.array().items(Joi.string().trim().max(50)).max(MAX_LANGUAGES).optional(),
  bio: Joi.string().trim().max(MAX_BIO_LENGTH).optional().allow(null, ''),
  preferredHours: preferredHoursSchema.optional(),
});

const updateProfile = Joi.object({
  languages: Joi.array().items(Joi.string().trim().max(50)).max(MAX_LANGUAGES).optional(),
  bio: Joi.string().trim().max(MAX_BIO_LENGTH).optional().allow(null, ''),
  skills: Joi.array().items(objectId).max(MAX_SKILLS).optional(),
  yearsOfExperience: Joi.number().integer().min(0).max(60).optional().allow(null),
  preferredHours: preferredHoursSchema.optional(),
}).min(1);

const updateKyc = Joi.object({});

const adminReviewProfile = Joi.object({
  profileStatus: Joi.string()
    .valid(BeauticianProfileStatus.APPROVED, BeauticianProfileStatus.REJECTED, BeauticianProfileStatus.SUSPENDED)
    .required(),
  rejectionReason: Joi.string().trim().max(500).when('profileStatus', {
    is: BeauticianProfileStatus.REJECTED,
    then: Joi.required(),
    otherwise: Joi.optional().allow(null, ''),
  }),
});

const adminReviewKyc = Joi.object({
  kycStatus: Joi.string()
    .valid(KycStatus.VERIFIED, KycStatus.REJECTED)
    .required(),
  kycRejectionReason: Joi.string().trim().max(500).when('kycStatus', {
    is: KycStatus.REJECTED,
    then: Joi.required(),
    otherwise: Joi.optional().allow(null, ''),
  }),
});

const profileIdParams = Joi.object({
  id: objectId.required(),
});

const listProfilesQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string().default(DEFAULT_BEAUTICIAN_PROFILE_SORT),
  profileStatus: Joi.string()
    .valid(...Object.values(BeauticianProfileStatus))
    .optional(),
  kycStatus: Joi.string()
    .valid(...Object.values(KycStatus))
    .optional(),
  isActive: boolField,
  includeDeleted: boolField.default(false),
  search: Joi.string().trim().max(100).allow(''),
});

// ── Work History ──────────────────────────────────────────────

const createWorkHistory = Joi.object({
  salonName: Joi.string().trim().max(MAX_SALON_NAME_LENGTH).required(),
  role: Joi.string().trim().max(MAX_ROLE_LENGTH).optional().allow(null, ''),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().optional().allow(null).greater(Joi.ref('startDate')),
  isCurrent: boolField.optional(),
});

const updateWorkHistory = Joi.object({
  salonName: Joi.string().trim().max(MAX_SALON_NAME_LENGTH).optional(),
  role: Joi.string().trim().max(MAX_ROLE_LENGTH).optional().allow(null, ''),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional().allow(null),
  isCurrent: boolField.optional(),
}).min(1);

const workHistoryIdParams = Joi.object({
  id: objectId.required(),
});

// ── Certificate ───────────────────────────────────────────────

const createCertificate = Joi.object({
  title: Joi.string().trim().max(MAX_CERTIFICATE_TITLE_LENGTH).required(),
  issueDate: Joi.date().iso().optional().allow(null),
});

const updateCertificate = Joi.object({
  title: Joi.string().trim().max(MAX_CERTIFICATE_TITLE_LENGTH).optional(),
  issueDate: Joi.date().iso().optional().allow(null),
}).min(1);

const adminReviewCertificate = Joi.object({
  status: Joi.string()
    .valid(CertificateStatus.VERIFIED, CertificateStatus.REJECTED)
    .required(),
  rejectionReason: Joi.string().trim().max(500).when('status', {
    is: CertificateStatus.REJECTED,
    then: Joi.required(),
    otherwise: Joi.optional().allow(null, ''),
  }),
});

const certificateIdParams = Joi.object({
  id: objectId.required(),
});

export class BeauticianProfileValidator extends BaseValidator {
  constructor() {
    super({
      createProfile,
      updateProfile,
      updateKyc,
      adminReviewProfile,
      adminReviewKyc,
      profileIdParams,
      listProfilesQuery,
      createWorkHistory,
      updateWorkHistory,
      workHistoryIdParams,
      createCertificate,
      updateCertificate,
      adminReviewCertificate,
      certificateIdParams,
    });
  }
}

export const beauticianProfileValidator = new BeauticianProfileValidator();
