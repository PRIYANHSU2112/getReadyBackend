import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AuthService } from '../../services/auth-service/src/services/auth.service.js';
import { JwtService } from '../../services/auth-service/src/services/jwt.service.js';

describe('Auth & User Microservice Test Suite', () => {
  let userClient;
  let otpRepo;
  let refreshTokenRepo;
  let jwtService;
  let smsService;
  let authService;
  let mockConfig;

  beforeEach(() => {
    jwtService = new JwtService(
      'test_jwt_secret_key_1234567890',
      '1h',
      'test_refresh_secret_key_1234567890',
      '7d',
    );

    mockConfig = {
      isProduction: false,
      jwt: { expiresIn: '1h' },
      otp: {
        length: 6,
        ttlSeconds: 300,
        resendCooldownSeconds: 60,
        maxResendsPerHour: 5,
        maxAttempts: 3,
      },
    };

    userClient = {
      findByPhone: jest.fn(),
      findByEmailForAuth: jest.fn(),
      updateLastLogin: jest.fn().mockImplementation((id, data) => ({ id, ...data })),
      createUser: jest.fn().mockImplementation((data) => ({
        _id: '65fc8e129182a1048b111002',
        ...data,
      })),
    };

    otpRepo = {
      otpKey: jest.fn().mockReturnValue('otp:test'),
      cooldownKey: jest.fn().mockReturnValue('cooldown:test'),
      resendKey: jest.fn().mockReturnValue('resend:test'),
      getCooldown: jest.fn().mockResolvedValue(null),
      setCooldown: jest.fn().mockResolvedValue(true),
      incrementResendCount: jest.fn().mockResolvedValue(1),
      setOtpRecord: jest.fn().mockResolvedValue(true),
      getOtpRecord: jest.fn().mockResolvedValue({ otp: '123456', attempts: 0 }),
      deleteOtpRecord: jest.fn().mockResolvedValue(true),
    };

    refreshTokenRepo = {
      saveRefreshToken: jest.fn().mockResolvedValue(true),
      findValidRefreshToken: jest.fn(),
      revokeByJti: jest.fn(),
    };

    smsService = {
      sendOtp: jest.fn().mockResolvedValue(true),
      sendEmailOtp: jest.fn().mockResolvedValue(true),
    };

    authService = new AuthService(
      otpRepo,
      refreshTokenRepo,
      userClient,
      jwtService,
      smsService,
      mockConfig,
    );
  });

  it('should generate and verify JWT tokens correctly', () => {
    const payload = { userId: '65fc8e129182a1048b111002', role: 'USER' };
    const accessToken = jwtService.signAccessToken(payload);
    expect(accessToken).toBeDefined();

    const decoded = jwtService.verifyAccessToken(accessToken);
    expect(decoded.userId).toBe('65fc8e129182a1048b111002');
    expect(decoded.role).toBe('USER');
  });

  it('should request OTP and return success message', async () => {
    const result = await authService.mobileSendOtp({ phone: '+919876543210', role: 'customer' });
    expect(result.message).toBe('OTP sent successfully');
    expect(otpRepo.setOtpRecord).toHaveBeenCalled();
  });
});
