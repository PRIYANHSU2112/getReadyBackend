import Joi from 'joi';

const phoneRegex = /^[+]?[\d\s-]{10,15}$/;

export const authValidator = {
  adminLogin: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
  }),

  adminForgotPassword: Joi.object({
    email: Joi.string().email().required(),
  }),

  adminResetPassword: Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.string().length(6).required(),
    newPassword: Joi.string().min(8).required(),
  }),

  mobileSendOtp: Joi.object({
    phone: Joi.string().pattern(phoneRegex).required(),
    role: Joi.string().valid('customer', 'beautician').default('customer'),
  }),

  mobileResendOtp: Joi.object({
    phone: Joi.string().pattern(phoneRegex).required(),
    role: Joi.string().valid('customer', 'beautician').default('customer'),
  }),

  mobileVerifyOtp: Joi.object({
    phone: Joi.string().pattern(phoneRegex).required(),
    otp: Joi.string().length(6).required(),
    role: Joi.string().valid('customer', 'beautician').default('customer'),
    name: Joi.string().trim().max(100).optional(),
    referralCode: Joi.string().trim().uppercase().optional(),
    fcmToken: Joi.string().trim().optional(),
  }),

  refreshToken: Joi.object({
    refreshToken: Joi.string().required(),
  }),

  logout: Joi.object({
    refreshToken: Joi.string().optional(),
  }),
};
