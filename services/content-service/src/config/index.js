import { loadServiceConfig } from '@getready/config';

export const config = loadServiceConfig('content-service', {
  port: parseInt(process.env.CONTENT_SERVICE_PORT || process.env.PORT || '3011', 10),
  database: {
    uri: process.env.DATABASE_URI,
  },
});
