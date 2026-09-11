import { loadServiceConfig } from '@getready/config';

export const config = loadServiceConfig('cart-service', {
  port: parseInt(process.env.CART_SERVICE_PORT || process.env.PORT || '3007', 10),
  database: {
    uri: process.env.DATABASE_URI,
  },
  catalogServiceUrl: process.env.CATALOG_SERVICE_URL || 'http://localhost:3005',
  userServiceUrl: process.env.USER_SERVICE_URL || 'http://localhost:3003',
  walletServiceUrl: process.env.WALLET_SERVICE_URL || 'http://localhost:3009',
});
