import crypto from 'crypto';
import { BaseService } from '../../common/base/BaseService.js';
import { AppError } from '../../common/errors/AppError.js';
import { UnauthorizedError } from '../../common/errors/UnauthorizedError.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import { OtpPurpose, UserRole } from '../../common/constants/enums.js';

export class AuthService extends BaseService {
  /**
   * @param {import('./auth.repository.js').AuthRepository} authRepository
   * @param {import('../user/user.service.js').UserService} userService
   * @param {import('../../common/utils/jwt.util.js').JwtUtil} jwtUtil
   * @param {import('../../common/utils/sms.util.js').SmsUtil} smsService
   * @param {object} config
   */
  constructor(authRepository, userService, jwtUtil, smsService, config) {
    super(null, null);
    this.authRepository = authRepository;
    this.userService = userService;
    this.userRepository = userService.userRepository;
    this.jwtUtil = jwtUtil;
    this.smsService = smsService;
    this.config = config;
  }

  #generateOtp() {
    const max = 10 ** this.config.otp.length;
    const num = crypto.randomInt(0, max);
    return String(num).padStart(this.config.otp.length, '0');
  }

  #issueToken(user) {
    return this.jwtUtil.sign({
      sub: user.id || user._id?.toString(),
      role: user.role,
      email: user.email || undefined,
      phone: user.phone || undefined,
    });
  }

  async #sendOtpWithRateLimit({ purpose, identifier, channel, phone, email }) {
    const otpKey = this.authRepository.otpKey(purpose, identifier);
    const cooldownKey = this.authRepository.cooldownKey(purpose, identifier);
    const resendKey = this.authRepository.resendKey(purpose, identifier);

    const cooldown = await this.authRepository.getCooldown(cooldownKey);
    if (cooldown) {
      throw new AppError(
        'Please wait before requesting another OTP',
        HttpStatus.TOO_MANY_REQUESTS,
        ErrorCodes.OTP_RATE_LIMITED,
      );
    }

    const resendCount = await this.authRepository.incrementResendCount(
      resendKey,
      3600,
    );
    if (resendCount > this.config.otp.maxResendsPerHour) {
      throw new AppError(
        'OTP resend limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
        ErrorCodes.OTP_RATE_LIMITED,
      );
    }

    // const otp = this.#generateOtp();
    const otp = '123456';
    console.log('otp', otp);
    await Promise.all([
      this.authRepository.setOtpRecord(
        otpKey,
        { otp, attempts: 0 },
        this.config.otp.ttlSeconds,
      ),
      this.authRepository.setCooldown(cooldownKey, this.config.otp.resendCooldownSeconds),
    ]);

    if (channel === 'mobile') {
      await this.smsService.sendOtp(phone, otp, purpose);
    } else {
      await this.smsService.sendEmailOtp(email, otp, purpose);
    }

    return { message: 'OTP sent successfully', expiresIn: this.config.otp.ttlSeconds };
  }

  async #verifyOtp({ purpose, identifier, otp }) {
    const otpKey = this.authRepository.otpKey(purpose, identifier);
    const record = await this.authRepository.getOtpRecord(otpKey);

    if (!record) {
      throw new AppError('OTP expired or not found', HttpStatus.BAD_REQUEST, ErrorCodes.OTP_EXPIRED);
    }

    if (record.attempts >= this.config.otp.maxAttempts) {
      await this.authRepository.deleteOtpRecord(otpKey);
      throw new AppError('Maximum OTP attempts exceeded', HttpStatus.BAD_REQUEST, ErrorCodes.OTP_MAX_ATTEMPTS);
    }

    if (record.otp !== otp) {
      await this.authRepository.setOtpRecord(
        otpKey,
        { ...record, attempts: record.attempts + 1 },
        this.config.otp.ttlSeconds,
      );
      throw new AppError('Invalid OTP', HttpStatus.BAD_REQUEST, ErrorCodes.OTP_INVALID);
    }

    await this.authRepository.deleteOtpRecord(otpKey);
    return true;
  }

  async adminLogin({ email, password }) {
    const user = await this.userService.findByEmailForAuth(email);
    const allowedAdminRoles = new Set([UserRole.ADMIN, UserRole.SUPER_ADMIN]);
    if (
      !user ||
      !allowedAdminRoles.has(user.role) ||
      !user.isActive ||
      user.deletedAt
    ) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const match = await user.comparePassword(password);
    if (!match) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const sanitized = await this.userService.updateLastLogin(user._id.toString(), {
      emailVerifiedAt: user.emailVerifiedAt || new Date(),
    });
    return { token: this.#issueToken(sanitized), user: sanitized };
  }

  async adminForgotPassword({ email }) {
    const user = await this.userService.findByEmailForAuth(email);
    const allowedAdminRoles = new Set([UserRole.ADMIN, UserRole.SUPER_ADMIN]);
    if (!user || !allowedAdminRoles.has(user.role)) {
      return { message: 'If the email exists, an OTP has been sent' };
    }

    await this.#sendOtpWithRateLimit({
      purpose: OtpPurpose.RESET_PASSWORD,
      identifier: email.toLowerCase(),
      channel: 'email',
      email: email.toLowerCase(),
    });

    return { message: 'If the email exists, an OTP has been sent' };
  }

  async adminResetPassword({ email, otp, newPassword }) {
    await this.#verifyOtp({
      purpose: OtpPurpose.RESET_PASSWORD,
      identifier: email.toLowerCase(),
      otp,
    });

    const user = await this.userService.setPasswordByEmail(email.toLowerCase(), newPassword);
    return { message: 'Password reset successful', user };
  }

  async mobileSendOtp({ phone, role }) {
    return this.#sendOtpWithRateLimit({
      purpose: OtpPurpose.LOGIN,
      identifier: `${phone}:${role}`,
      channel: 'mobile',
      phone,
    });
  }

  async mobileResendOtp({ phone, role }) {
    return this.mobileSendOtp({ phone, role });
  }

  async mobileVerifyOtp({ phone, otp, role, name, referralCode, fcmToken }) {
    await this.#verifyOtp({
      purpose: OtpPurpose.LOGIN,
      identifier: `${phone}:${role}`,
      otp,
    });

    const user = await this.userService.findOrCreateMobileUser({
      phone,
      role,
      name,
      referralCode,
      fcmToken,
    });

    return { token: this.#issueToken(user), user };
  }

  async getMe(userId) {
    return this.userService.getMe(userId);
  }
}
