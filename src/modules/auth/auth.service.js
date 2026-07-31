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
   * @param {import('./refresh-token.repository.js').RefreshTokenRepository|null} [refreshTokenRepository]
   */
  constructor(
    authRepository,
    userService,
    jwtUtil,
    smsService,
    config,
    refreshTokenRepository = null,
  ) {
    super(null, null);
    this.authRepository = authRepository;
    this.userService = userService;
    this.userRepository = userService.userRepository;
    this.jwtUtil = jwtUtil;
    this.smsService = smsService;
    this.config = config;
    this.refreshTokenRepository = refreshTokenRepository;
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
      role: user.role,
      email: user.email || undefined,
      phone: user.phone || undefined,
    };

    const jti = crypto.randomUUID();
    const accessToken = this.jwtUtil.signAccessToken
      ? this.jwtUtil.signAccessToken(payload)
      : this.jwtUtil.sign(payload);

    const refreshToken = this.jwtUtil.signRefreshToken
      ? this.jwtUtil.signRefreshToken(payload, { jwtid: jti })
      : this.jwtUtil.sign({ ...payload, tokenType: 'refresh' }, { jwtid: jti });

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

  async adminLogin({ email, password }, reqInfo = {}) {
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

    const tokenPair = await this.#issueTokenPair(sanitized, reqInfo);
    return { ...tokenPair, user: sanitized };
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

  async mobileVerifyOtp({ phone, otp, role, name, referralCode, fcmToken }, reqInfo = {}) {
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

    const tokenPair = await this.#issueTokenPair(user, reqInfo);
    return { ...tokenPair, user };
  }

  async refreshToken({ refreshToken, createdByIp = null, userAgent = null }) {
    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token is required');
    }

    let decoded;
    try {
      decoded = this.jwtUtil.verifyRefreshToken
        ? this.jwtUtil.verifyRefreshToken(refreshToken)
        : this.jwtUtil.verify(refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const userId = decoded.sub;

    if (this.refreshTokenRepository) {
      const stored = await this.refreshTokenRepository.findByToken(refreshToken);
      if (!stored) {
        throw new UnauthorizedError('Refresh token not found');
      }

      if (stored.isRevoked) {
        await this.refreshTokenRepository.revokeAllUserTokens(userId);
        throw new UnauthorizedError('Security alert: Revoked refresh token reuse detected');
      }

      const user = await this.userRepository.findById(userId);
      if (!user || !user.isActive || user.deletedAt) {
        throw new UnauthorizedError('User account not active');
      }

      const tokenPair = await this.#issueTokenPair(user, { createdByIp, userAgent });
      await this.refreshTokenRepository.revokeToken(refreshToken, {
        replacedByToken: tokenPair.refreshToken,
      });

      return { ...tokenPair, user };
    }

    const user = await this.userRepository.findById(userId);
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
    return { message: 'Logged out successfully' };
  }

  async getMe(userId) {
    return this.userService.getMe(userId);
  }
}
