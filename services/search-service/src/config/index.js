import { loadServiceConfig } from '@getready/config';

export const config = loadServiceConfig('search-service', {
  port: parseInt(process.env.SEARCH_SERVICE_PORT || process.env.PORT || '3012', 10),
  elasticsearch: {
    node: process.env.ELASTICSEARCH_NODE || process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    username: process.env.ELASTICSEARCH_USERNAME || null,
    password: process.env.ELASTICSEARCH_PASSWORD || null,
    requestTimeout: parseInt(process.env.ELASTICSEARCH_TIMEOUT_MS || '800', 10),
    maxRetries: parseInt(process.env.ELASTICSEARCH_MAX_RETRIES || '0', 10),
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
  },
  mongoUri: process.env.DATABASE_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/getready_dev',
});

export default config;
