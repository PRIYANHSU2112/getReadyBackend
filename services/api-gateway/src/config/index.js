import { loadServiceConfig } from '@getready/config';

export const config = loadServiceConfig('api-gateway', {
  port: parseInt(process.env.GATEWAY_PORT || process.env.PORT || '3000', 10),
  services: {
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    user: process.env.USER_SERVICE_URL || 'http://localhost:3002',
    beautician: process.env.BEAUTICIAN_SERVICE_URL || 'http://localhost:3003',
    catalog: process.env.CATALOG_SERVICE_URL || 'http://localhost:3004',
    booking: process.env.BOOKING_SERVICE_URL || 'http://localhost:3005',
    cart: process.env.CART_SERVICE_URL || 'http://localhost:3006',
    payment: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3007',
    wallet: process.env.WALLET_SERVICE_URL || 'http://localhost:3008',
    notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3009',
    content: process.env.CONTENT_SERVICE_URL || 'http://localhost:3010',
  },
});

export default config;
