import { loadServiceConfig } from '@getready/config';

export const config = loadServiceConfig('wallet-service', {
  port: parseInt(process.env.WALLET_SERVICE_PORT || process.env.PORT || '3009', 10),
  database: {
    uri: process.env.DATABASE_URI,
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  },
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  payout: {
    minWithdrawalAmount: parseInt(process.env.MIN_WITHDRAWAL_AMOUNT || '100', 10),
    defaultCommissionPercentage: parseInt(process.env.DEFAULT_COMMISSION_PERCENTAGE || '20', 10),
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock_key',
    keySecret: process.env.RAZORPAY_KEY_SECRET || 'mock_secret',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || 'mock_webhook_secret',
  },
});
