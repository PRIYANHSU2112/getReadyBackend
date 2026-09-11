import { logger } from '@getready/logger';

export class SmsService {
  constructor(provider = 'console') {
    this.provider = provider;
  }

  async sendOtp(phone, otp, purpose) {
    logger.info({ phone, otp, purpose, provider: this.provider }, `[SMS OTP] Code ${otp} for ${purpose} sent to ${phone}`);
    return true;
  }

  async sendEmailOtp(email, otp, purpose) {
    logger.info({ email, otp, purpose, provider: this.provider }, `[EMAIL OTP] Code ${otp} for ${purpose} sent to ${email}`);
    return true;
  }
}
