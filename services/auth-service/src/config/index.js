import { loadServiceConfig } from '@getready/config';

export const config = loadServiceConfig('auth-service', {
  port: parseInt(process.env.AUTH_PORT || '3001', 10),
  mongoUri: process.env.DATABASE_URI,
  userServiceUrl: process.env.USER_SERVICE_URL || 'http://localhost:3002',
  otp: {
    ttlSeconds: parseInt(process.env.OTP_TTL_SECONDS || '300', 10),
    length: parseInt(process.env.OTP_LENGTH || '6', 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10),
    resendCooldownSeconds: parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '30', 10),
    maxResendsPerHour: parseInt(process.env.OTP_MAX_RESENDS_PER_HOUR || '3', 10),
  },
  smsProvider: process.env.SMS_PROVIDER || 'console',
});

export default config;
