import { loadServiceConfig } from '@getready/config';

export const config = loadServiceConfig('catalog-service', {
  port: parseInt(process.env.CATALOG_PORT || '3004', 10),
  mongoUri: process.env.DATABASE_URI,
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local',
    region: process.env.AWS_REGION || 'sgp1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    bucket: process.env.AWS_BUCKET_NAME || '',
    endpoint: process.env.AWS_S3_ENDPOINT || '',
  },
});

export default config;
