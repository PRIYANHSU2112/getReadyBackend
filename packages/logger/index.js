import pinoHttp from 'pino-http';
import { createLogger, logger } from './logger.js';

export function createHttpLogger(customLogger = logger) {
  return pinoHttp({
    logger: customLogger,
    customProps: (req) => ({
      requestId: req.requestId || req.headers['x-request-id'],
      correlationId: req.correlationId || req.headers['x-correlation-id'],
      userId: req.user?.id,
    }),
    customErrorMessage: (_req, _res, err) =>
      err ? err.message : 'Request completed with error status',
    autoLogging: {
      ignore: (req) => {
        const url = req.url || '';
        return url.endsWith('/health') || url.endsWith('/ready') || url.endsWith('/metrics');
      },
    },
  });
}

export { createLogger, logger };
export default logger;
