import { loadServiceConfig } from '@getready/config';

export const config = loadServiceConfig('payment-service', {
  port: parseInt(process.env.PAYMENT_SERVICE_PORT || process.env.PORT || '3008', 10),
  database: {
    uri: process.env.DATABASE_URI,
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock_key',
    keySecret: process.env.RAZORPAY_KEY_SECRET || 'mock_secret',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || 'mock_webhook_secret',
  },
});
