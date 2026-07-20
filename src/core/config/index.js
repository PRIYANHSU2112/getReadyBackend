import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import development from './environments/development.js';
import test from './environments/test.js';
import staging from './environments/staging.js';
import production from './environments/production.js';

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
  appUrl: env.APP_URL || 'http://localhost:3000',
  mongodbUri: env.MONGODB_URI || 'mongodb://localhost:27017/salon',
  redis: {
    host: env.REDIS_HOST || '127.0.0.1',
    port: Number(env.REDIS_PORT) || 6379,
    password: env.REDIS_PASSWORD || undefined,
  },
  jwt: {
    secret: env.JWT_SECRET || 'jwt-secret-key',
    expiresIn: env.JWT_EXPIRES_IN || '1d',
  },
  corsOrigins,
  storage: {
    provider: overrides.storageProvider || env.STORAGE_PROVIDER || 'local',
    localPath: env.STORAGE_LOCAL_PATH || 'uploads',
    s3: {
      region: env.AWS_REGION || 'us-east-1',
      accessKeyId: env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY || '',
      bucket: env.AWS_S3_BUCKET || '',
    },
    cloudinary: {
      cloudName: env.CLOUDINARY_CLOUD_NAME || '',
      apiKey: env.CLOUDINARY_API_KEY || '',
      apiSecret: env.CLOUDINARY_API_SECRET || '',
    },
  },
  logLevel: overrides.logLevel || env.LOG_LEVEL || 'info',
  cacheTtlSeconds: overrides.cacheTtlSeconds ?? 60,
  metricsEnabled: overrides.metricsEnabled ?? parseBool(env.METRICS_ENABLED, true),
  swaggerEnabled: overrides.swaggerEnabled ?? true,
  otel: {
    enabled: parseBool(env.OTEL_ENABLED, false),
    serviceName: env.OTEL_SERVICE_NAME || 'salon-api',
  },
});

export default config;
export { config };
