import { loadServiceConfig } from '@getready/config';

export const config = loadServiceConfig('beautician-service', {
  port: parseInt(process.env.BEAUTICIAN_PORT || '3003', 10),
  mongoUri: process.env.DATABASE_URI,
  userServiceUrl: process.env.USER_SERVICE_URL || 'http://localhost:3002',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local',
    region: process.env.AWS_REGION || 'sgp1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    bucket: process.env.AWS_BUCKET_NAME || '',
    endpoint: process.env.AWS_ENDPOINT || process.env.AWS_S3_ENDPOINT || '',
  },
});

export default config;
