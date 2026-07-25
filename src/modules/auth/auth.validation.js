import { BaseValidator } from '../../common/base/BaseValidator.js';
import { UserRole } from '../../common/constants/enums.js';

const { Joi } = BaseValidator;

/** Allow custom / non-IANA TLDs (e.g. .local) used in seed/dev. */
const emailSchema = Joi.string().email({ tlds: { allow: false } });

const phoneSchema = Joi.string().pattern(/^\+?[1-9]\d{7,14}$/).required();

const adminLogin = Joi.object({
  email: emailSchema.required(),
  password: Joi.string().required(),
});

const adminForgotPassword = Joi.object({
  email: emailSchema.required(),
});

const adminResetPassword = Joi.object({
  email: emailSchema.required(),
  otp: Joi.string().length(6).pattern(/^\d+$/).required(),
  newPassword: Joi.string().min(8).max(128).required(),
});

const mobileSendOtp = Joi.object({
  phone: phoneSchema,
  role: Joi.string().valid(UserRole.CUSTOMER, UserRole.BEAUTICIAN).required(),
});

const mobileResendOtp = Joi.object({
  phone: phoneSchema,
  role: Joi.string().valid(UserRole.CUSTOMER, UserRole.BEAUTICIAN).required(),
});

const mobileVerifyOtp = Joi.object({
  phone: phoneSchema,
  otp: Joi.string().length(6).pattern(/^\d+$/).required(),
  role: Joi.string().valid(UserRole.CUSTOMER, UserRole.BEAUTICIAN).required(),
  name: Joi.string().min(2).max(100).optional(),
  referralCode: Joi.string().uppercase().trim().min(4).max(32).optional(),
  fcmToken: Joi.string().max(512).optional(),
});

export class AuthValidator extends BaseValidator {
  constructor() {
    super({
      adminLogin,
      adminForgotPassword,
      adminResetPassword,
      mobileSendOtp,
      mobileResendOtp,
      mobileVerifyOtp,
    });
  }
}

export const authValidator = new AuthValidator();
