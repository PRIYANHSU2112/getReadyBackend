import { logger } from '../../core/logger/pino.logger.js';

export class SmsUtil {

  constructor(config = {}) {
    this.provider = config.provider || 'console';
  }

  async sendOtp(phone, otp, purpose) {
    if (this.provider === 'console') {
      logger.info({ phone, otp, purpose }, '[SMS] OTP (dev console provider)');
      return true;
    }
    logger.warn({ provider: this.provider }, '[SMS] Provider not configured — OTP logged only');
    logger.info({ phone, otp, purpose }, '[SMS] OTP fallback log');
    return true;
  }


  async sendEmailOtp(email, otp, purpose) {
    logger.info({ email, otp, purpose }, '[Email] OTP (dev console provider)');
    return true;
  }
}
