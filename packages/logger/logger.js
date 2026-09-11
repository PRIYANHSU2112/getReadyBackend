import pino from 'pino';

const REDACTED_PATHS = [
  'password',
  '*.password',
  'newPassword',
  '*.newPassword',
  'otp',
  '*.otp',
  'token',
  '*.token',
  'refreshToken',
  '*.refreshToken',
  'accessToken',
  '*.accessToken',
  'authorization',
  'req.headers.authorization',
  'cookie',
  'req.headers.cookie',
  'secret',
  '*.secret',
  'razorpayKeySecret',
  'razorpaySignature',
  'cardNumber',
  'cvv',
];

export function createLogger(serviceName = 'service', options = {}) {
  const isProduction = process.env.NODE_ENV === 'production';
  const logLevel = options.level || process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

  const pinoOptions = {
    name: serviceName,
    level: logLevel,
    redact: {
      paths: REDACTED_PATHS,
      censor: '[REDACTED]',
    },
    formatters: {
      level(label) {
        return { level: label };
      },
      bindings(bindings) {
        return {
          service: serviceName,
          environment: process.env.NODE_ENV || 'development',
          pid: bindings.pid,
          hostname: bindings.hostname,
        };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    ...options,
  };

  if (!isProduction && process.env.PRETTY_LOGS !== 'false') {
    // In local dev, use pino-pretty if not in strict json mode
    return pino({
      ...pinoOptions,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  return pino(pinoOptions);
}

export const logger = createLogger(process.env.APP_NAME || 'getready-service');
export default logger;
