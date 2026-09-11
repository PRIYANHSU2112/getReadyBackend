import { loadServiceConfig } from '@getready/config';

export const config = loadServiceConfig('worker-service', {
  port: parseInt(process.env.WORKER_SERVICE_PORT || process.env.PORT || '3012', 10),
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  },
  database: {
    bookingUri: process.env.DATABASE_URI,
  },
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
});
