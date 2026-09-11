import { loadServiceConfig } from '@getready/config';

export const config = loadServiceConfig('booking-service', {
  port: parseInt(process.env.BOOKING_PORT || '3005', 10),
  mongoUri: process.env.DATABASE_URI,
  holdTtlSeconds: parseInt(process.env.SLOT_HOLD_TTL_SECONDS || '300', 10),
});

export default config;
