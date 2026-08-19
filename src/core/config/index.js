import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import development from './environments/development.js';
import test from './environments/test.js';
import staging from './environments/staging.js';
import production from './environments/production.js';
import { StorageProvider } from '../../common/constants/enums.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const envOverrides = {
  development,
  test,
  staging,
  production,
};

const env = process.env;
const envName = env.NODE_ENV || 'development';
const overrides = envOverrides[envName] || development;

const parseBool = (value, defaultValue = false) => {
  if (value === undefined || value === '') return defaultValue;
  return value === 'true' || value === '1';
};

const corsOrigins = (env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const config = Object.freeze({
  env: envName,
  isProduction: envName === 'production',
  isTest: envName === 'test',
  port: Number(env.PORT) || 3000,
  appName: env.APP_NAME || 'salon-api',
  appUrl: env.APP_URL || `http://localhost:${Number(env.PORT) || 3000}`,
  mongodbUri: env.MONGODB_URI || env.DATABASE_URI || 'mongodb://localhost:27017/salon',
  redis: {
    enabled:
      env.REDIS_ENABLED !== undefined
        ? parseBool(env.REDIS_ENABLED, false)
        : envName === 'production' || envName === 'staging',
    host: env.REDIS_HOST || '127.0.0.1',
    port: Number(env.REDIS_PORT) || 6379,
    password: env.REDIS_PASSWORD && env.REDIS_PASSWORD !== 'yourpassword' ? env.REDIS_PASSWORD : undefined,
  },
  jwt: {
    secret: env.JWT_SECRET || 'jwt-secret-key',
    expiresIn: env.JWT_EXPIRES_IN || '1d',
    refreshSecret: env.JWT_REFRESH_SECRET || env.JWT_SECRET || 'jwt-refresh-secret-key',
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  otp: {
    ttlSeconds: Number(env.OTP_TTL_SECONDS) || 300,
    length: Number(env.OTP_LENGTH) || 6,
    maxAttempts: Number(env.OTP_MAX_ATTEMPTS) || 5,
    resendCooldownSeconds: Number(env.OTP_RESEND_COOLDOWN_SECONDS) || 30,
    maxResendsPerHour: Number(env.OTP_MAX_RESENDS_PER_HOUR) || 3,
  },
  sms: {
    provider: env.SMS_PROVIDER || 'console',
  },
  corsOrigins,
  razorpay: {
    keyId: env.RAZORPAY_KEY_ID || 'rzp_test_mock_key',
    keySecret: env.RAZORPAY_KEY_SECRET || 'mock_secret',
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET || 'mock_webhook_secret',
  },
  storage: {
    /** Application uses S3 only */
    provider: StorageProvider.S3,
    s3: {
      region:
        env.AWS_REGION ||
        env.LINODE_OBJECT_STORAGE_REGION ||
        'us-east-1',
      accessKeyId:
        env.AWS_ACCESS_KEY_ID ||
        env.LINODE_OBJECT_STORAGE_ACCESS_KEY_ID ||
        '',
      secretAccessKey:
        env.AWS_SECRET_ACCESS_KEY ||
        env.LINODE_OBJECT_STORAGE_SECRET_ACCESS_KEY ||
        '',
      bucket:
        env.AWS_BUCKET_NAME ||
        env.AWS_S3_BUCKET ||
        env.LINODE_OBJECT_BUCKET ||
        '',
      endpoint: env.AWS_S3_ENDPOINT || env.LINODE_OBJECT_STORAGE_ENDPOINT || undefined,
      folder: env.BUCKET_FOLDER_PATH || env.STORAGE_FOLDER || 'uploads',
      publicRead: parseBool(env.S3_PUBLIC_READ, true),
    },
  },
  logLevel: overrides.logLevel || env.LOG_LEVEL || 'info',
  cacheTtlSeconds: overrides.cacheTtlSeconds ?? 60,
  metricsEnabled: overrides.metricsEnabled ?? parseBool(env.METRICS_ENABLED, true),
  swaggerEnabled:
    env.SWAGGER_ENABLED !== undefined && env.SWAGGER_ENABLED !== ''
      ? parseBool(env.SWAGGER_ENABLED, false)
      : (overrides.swaggerEnabled ?? true),
  otel: {
    enabled: parseBool(env.OTEL_ENABLED, false),
    serviceName: env.OTEL_SERVICE_NAME || 'salon-api',
  },
});

export default config;
export { config };
