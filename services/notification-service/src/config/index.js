import { loadServiceConfig } from '@getready/config';

export const config = loadServiceConfig('notification-service', {
  port: parseInt(process.env.NOTIFICATION_SERVICE_PORT || process.env.PORT || '3010', 10),
  database: {
    uri: process.env.DATABASE_URI,
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  },
  fcm: {
    serverKey: process.env.FCM_SERVER_KEY || 'mock_fcm_key',
  },
});
