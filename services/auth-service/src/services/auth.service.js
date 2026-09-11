import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
  AppError,
  UnauthorizedError,
  HttpStatus,
  ErrorCodes,
} from '@getready/errors';
import { EVENT_TYPES } from '@getready/rabbitmq';

export class AuthService {
  /**
   * @param {import('../repositories/otp.repository.js').OtpRepository} otpRepository
   * @param {import('../repositories/refresh-token.repository.js').RefreshTokenRepository} refreshTokenRepository
   * @param {import('./user-client.js').UserClient} userClient
   * @param {import('./jwt.service.js').JwtService} jwtService
   * @param {import('./sms.service.js').SmsService} smsService
   * @param {import('../config/index.js').config} config
   * @param {import('@getready/rabbitmq').EventPublisher|null} eventPublisher
   */
  constructor(
    otpRepository,
    refreshTokenRepository,
    userClient,
    jwtService,
    smsService,
    config,
    eventPublisher = null,
  ) {
    this.otpRepository = otpRepository;
    this.refreshTokenRepository = refreshTokenRepository;
    this.userClient = userClient;
    this.jwtService = jwtService;
    this.smsService = smsService;
    this.config = config;
    this.eventPublisher = eventPublisher;
  }

  #generateOtp() {
    const max = 10 ** this.config.otp.length;
    const num = crypto.randomInt(0, max);
    return String(num).padStart(this.config.otp.length, '0');
  }

  async #issueTokenPair(user, { createdByIp = null, userAgent = null } = {}) {
    const userIdStr = user.id || user._id?.toString();
    const payload = {
      sub: userIdStr,
      id: userIdStr,
      role: user.role,
      email: user.email || undefined,
      phone: user.phone || undefined,
    };

    const jti = crypto.randomUUID();
    const accessToken = this.jwtService.signAccessToken(payload);
    const refreshToken = this.jwtService.signRefreshToken(
      { ...payload, tokenType: 'refresh' },
      { jwtid: jti },
    );

    if (this.refreshTokenRepository) {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await this.refreshTokenRepository.saveRefreshToken({
        userId: userIdStr,
        token: refreshToken,
        jti,
        expiresAt,
        createdByIp,
        userAgent,
      });
    }

    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.jwt.expiresIn,
    };
  }

  async #sendOtpWithRateLimit({ purpose, identifier, channel, phone, email }) {
    const otpKey = this.otpRepository.otpKey(purpose, identifier);
    const cooldownKey = this.otpRepository.cooldownKey(purpose, identifier);
    const resendKey = this.otpRepository.resendKey(purpose, identifier);

    const cooldown = await this.otpRepository.getCooldown(cooldownKey);
    if (cooldown) {
      throw new AppError(
        'Please wait before requesting another OTP',
        HttpStatus.TOO_MANY_REQUESTS,
        ErrorCodes.OTP_RATE_LIMITED,
      );
    }

    const resendCount = await this.otpRepository.incrementResendCount(
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

    const otp = this.config.isProduction ? this.#generateOtp() : '123456';
    await Promise.all([
      this.otpRepository.setOtpRecord(
        otpKey,
        { otp, attempts: 0 },
        this.config.otp.ttlSeconds,
      ),
      this.otpRepository.setCooldown(
        cooldownKey,
        this.config.otp.resendCooldownSeconds,
      ),
    ]);

    if (channel === 'mobile') {
      await this.smsService.sendOtp(phone, otp, purpose);
    } else {
      await this.smsService.sendEmailOtp(email, otp, purpose);
    }

    return {
      message: 'OTP sent successfully',
      expiresIn: this.config.otp.ttlSeconds,
    };
  }

  async #verifyOtp({ purpose, identifier, otp }) {
    const otpKey = this.otpRepository.otpKey(purpose, identifier);
    const record = await this.otpRepository.getOtpRecord(otpKey);

    if (!record) {
      throw new AppError(
        'OTP expired or not found',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.OTP_EXPIRED,
      );
    }

    if (record.attempts >= this.config.otp.maxAttempts) {
      await this.otpRepository.deleteOtpRecord(otpKey);
      throw new AppError(
        'Maximum OTP attempts exceeded',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.OTP_MAX_ATTEMPTS,
      );
    }

    if (record.otp !== otp) {
      await this.otpRepository.setOtpRecord(
        otpKey,
        { ...record, attempts: record.attempts + 1 },
        this.config.otp.ttlSeconds,
      );
      throw new AppError(
        'Invalid OTP',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.OTP_INVALID,
      );
    }

    await this.otpRepository.deleteOtpRecord(otpKey);
    return true;
  }

  async adminLogin({ email, password }, reqInfo = {}) {
    const user = await this.userClient.findByEmailForAuth(email);
    const allowedAdminRoles = new Set(['admin', 'super_admin']);

    if (
      !user ||
      !allowedAdminRoles.has(user.role) ||
      !user.isActive ||
      user.deletedAt
    ) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const match = await bcrypt.compare(password, user.passwordHash || user.password || '');
    if (!match) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const sanitized = await this.userClient.updateLastLogin(user.id || user._id, {
      emailVerifiedAt: user.emailVerifiedAt || new Date(),
    });

    const tokenPair = await this.#issueTokenPair(sanitized || user, reqInfo);

    if (this.eventPublisher) {
      this.eventPublisher.publish('auth.login', EVENT_TYPES.USER_LOGGED_IN, {
        userId: user.id || user._id,
        role: user.role,
        email: user.email,
        channel: 'admin',
      }).catch(() => {});
    }

    return { ...tokenPair, user: sanitized || user };
  }

  async adminForgotPassword({ email }) {
    const user = await this.userClient.findByEmailForAuth(email);
    const allowedAdminRoles = new Set(['admin', 'super_admin']);
    if (!user || !allowedAdminRoles.has(user.role)) {
      return { message: 'If the email exists, an OTP has been sent' };
    }

    await this.#sendOtpWithRateLimit({
      purpose: 'reset_password',
      identifier: email.toLowerCase(),
      channel: 'email',
      email: email.toLowerCase(),
    });

    if (this.eventPublisher) {
      this.eventPublisher.publish('auth.password_reset_requested', EVENT_TYPES.PASSWORD_RESET_REQUESTED, {
        email,
        userId: user.id || user._id,
      }).catch(() => {});
    }

    return { message: 'If the email exists, an OTP has been sent' };
  }

  async adminResetPassword({ email, otp, newPassword }) {
    await this.#verifyOtp({
      purpose: 'reset_password',
      identifier: email.toLowerCase(),
      otp,
    });

    const user = await this.userClient.setPasswordByEmail(
      email.toLowerCase(),
      newPassword,
    );

    if (this.eventPublisher) {
      this.eventPublisher.publish('auth.password_reset_completed', EVENT_TYPES.PASSWORD_RESET_COMPLETED, {
        email,
        userId: user.id || user._id,
      }).catch(() => {});
    }

    return { message: 'Password reset successful', user };
  }

  async mobileSendOtp({ phone, role }) {
    return this.#sendOtpWithRateLimit({
      purpose: 'login',
      identifier: `${phone}:${role}`,
      channel: 'mobile',
      phone,
    });
  }

  async mobileResendOtp({ phone, role }) {
    return this.mobileSendOtp({ phone, role });
  }

  async mobileVerifyOtp(
    { phone, otp, role, name, referralCode, fcmToken },
    reqInfo = {},
  ) {
    await this.#verifyOtp({
      purpose: 'login',
      identifier: `${phone}:${role}`,
      otp,
    });

    const user = await this.userClient.findOrCreateMobileUser({
      phone,
      role,
      name,
      referralCode,
      fcmToken,
    });

    const tokenPair = await this.#issueTokenPair(user, reqInfo);

    if (this.eventPublisher) {
      this.eventPublisher.publish('auth.login', EVENT_TYPES.USER_LOGGED_IN, {
        userId: user.id || user._id,
        role: user.role,
        phone: user.phone,
        channel: 'mobile',
      }).catch(() => {});
    }

    return { ...tokenPair, user };
  }

  async refreshToken({ refreshToken, createdByIp = null, userAgent = null }) {
    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token is required');
    }

    let decoded;
    try {
      decoded = this.jwtService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const userId = decoded.sub || decoded.id;

    if (this.refreshTokenRepository) {
      const stored = await this.refreshTokenRepository.findByToken(refreshToken);
      if (!stored) {
        throw new UnauthorizedError('Refresh token not found');
      }

      if (stored.isRevoked) {
        await this.refreshTokenRepository.revokeAllUserTokens(userId);
        throw new UnauthorizedError('Security alert: Revoked refresh token reuse detected');
      }

      const user = await this.userClient.findById(userId);
      if (!user || !user.isActive || user.deletedAt) {
        throw new UnauthorizedError('User account not active');
      }

      const tokenPair = await this.#issueTokenPair(user, { createdByIp, userAgent });
      await this.refreshTokenRepository.revokeToken(refreshToken, {
        replacedByToken: tokenPair.refreshToken,
      });

      return { ...tokenPair, user };
    }

    const user = await this.userClient.findById(userId);
    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedError('User account not active');
    }

    const tokenPair = await this.#issueTokenPair(user, { createdByIp, userAgent });
    return { ...tokenPair, user };
  }

  async logout({ userId, refreshToken }) {
    if (this.refreshTokenRepository && refreshToken) {
      await this.refreshTokenRepository.revokeToken(refreshToken);
    } else if (this.refreshTokenRepository && userId) {
      await this.refreshTokenRepository.revokeAllUserTokens(userId);
    }

    if (this.eventPublisher && userId) {
      this.eventPublisher.publish('auth.logout', EVENT_TYPES.USER_LOGGED_OUT, {
        userId,
      }).catch(() => {});
    }

    return { message: 'Logged out successfully' };
  }

  async getMe(userId) {
    return this.userClient.getMe(userId);
  }
}
