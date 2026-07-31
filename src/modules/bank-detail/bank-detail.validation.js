import { BaseValidator } from '../../common/base/BaseValidator.js';
import { BankVerificationStatus } from '../../common/constants/enums.js';
import {
  BANK_SORT_FIELDS,
  DEFAULT_BANK_SORT,
  IFSC_REGEX,
  MAX_ACCOUNT_HOLDER_NAME_LENGTH,
  MAX_ACCOUNT_NUMBER_LENGTH,
  MAX_BANK_NAME_LENGTH,
  MAX_BRANCH_NAME_LENGTH,
  MAX_UPI_ID_LENGTH,
} from '../../common/constants/bank-detail.js';

const { Joi } = BaseValidator;

const objectId = Joi.string().hex().length(24);

const createBankDetail = Joi.object({
  accountHolderName: Joi.string().trim().max(MAX_ACCOUNT_HOLDER_NAME_LENGTH).required(),
  accountNumber: Joi.string().trim().max(MAX_ACCOUNT_NUMBER_LENGTH).required(),
  ifscCode: Joi.string()
    .trim()
    .uppercase()
    .pattern(IFSC_REGEX)
    .required()
    .messages({ 'string.pattern.base': 'Invalid IFSC code format' }),
  bankName: Joi.string().trim().max(MAX_BANK_NAME_LENGTH).optional().allow(null, ''),
  branchName: Joi.string().trim().max(MAX_BRANCH_NAME_LENGTH).optional().allow(null, ''),
  upiId: Joi.string().trim().max(MAX_UPI_ID_LENGTH).optional().allow(null, ''),
});

const updateBankDetail = Joi.object({
  accountHolderName: Joi.string().trim().max(MAX_ACCOUNT_HOLDER_NAME_LENGTH).optional(),
  accountNumber: Joi.string().trim().max(MAX_ACCOUNT_NUMBER_LENGTH).optional(),
  ifscCode: Joi.string()
    .trim()
    .uppercase()
    .pattern(IFSC_REGEX)
    .optional()
    .messages({ 'string.pattern.base': 'Invalid IFSC code format' }),
  bankName: Joi.string().trim().max(MAX_BANK_NAME_LENGTH).optional().allow(null, ''),
  branchName: Joi.string().trim().max(MAX_BRANCH_NAME_LENGTH).optional().allow(null, ''),
  upiId: Joi.string().trim().max(MAX_UPI_ID_LENGTH).optional().allow(null, ''),
}).min(1);

const bankDetailIdParams = Joi.object({
  id: objectId.required(),
});

const adminReviewBankDetail = Joi.object({
  status: Joi.string()
    .valid(BankVerificationStatus.VERIFIED, BankVerificationStatus.REJECTED)
    .required(),
  rejectionReason: Joi.string().trim().max(500).when('status', {
    is: BankVerificationStatus.REJECTED,
    then: Joi.required(),
    otherwise: Joi.optional().allow(null, ''),
  }),
});

const listBankDetailsQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string().default(DEFAULT_BANK_SORT),
  status: Joi.string()
    .valid(...Object.values(BankVerificationStatus))
    .optional(),
});

export class BankDetailValidator extends BaseValidator {
  constructor() {
    super({
      createBankDetail,
      updateBankDetail,
      bankDetailIdParams,
      adminReviewBankDetail,
      listBankDetailsQuery,
    });
  }
}

export const bankDetailValidator = new BankDetailValidator();
