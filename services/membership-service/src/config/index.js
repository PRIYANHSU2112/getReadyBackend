import { loadServiceConfig } from '@getready/config';

export const config = loadServiceConfig('membership-service', {
  port: parseInt(process.env.MEMBERSHIP_PORT || process.env.PORT || '3011', 10),
  mongoUri: process.env.MONGODB_URI || process.env.MEMBERSHIP_MONGO_URI || 'mongodb://localhost:27017/getready_membership',
  redisUrl: process.env.REDIS_URL || (process.env.REDIS_HOST ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}` : null),
  jwtSecret: process.env.JWT_SECRET || 'getready-secret-key-change-in-production',
  corsOrigins: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000', 'http://localhost:5173'],
  metricsEnabled: process.env.METRICS_ENABLED !== 'false',
});

export default config;
