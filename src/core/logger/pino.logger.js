import pino from 'pino';
import config from '../config/index.js';

const isDev = config.env === 'development';

export const logger = pino({
  name: config.appName,
  level: config.logLevel,
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard' },
        },
      }
    : {}),
});

export default logger;
