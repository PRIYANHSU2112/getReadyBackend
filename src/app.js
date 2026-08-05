import express from 'express';
import pinoHttp from 'pino-http';

import config from './core/config/index.js';
import { logger } from './core/logger/pino.logger.js';
import { createShared } from './core/shared.js';
import { setupSwagger } from './core/swagger/index.js';
import {
  requestIdMiddleware,
  responseTimeMiddleware,
  createErrorMiddleware,
  notFoundHandler,
} from './common/middleware/index.js';
import { createRootRouter } from './routes/index.js';

/**
 * Build Express app (HTTP layer only).
 * Module wiring happens in routes via createXxxModule(shared).
 *
 * @param {object} [options]
 * @param {ReturnType<typeof createShared>} [options.shared]
 * @param {(app: import('express').Express) => void} [options.applyMiddleware]
 */
export function createApp(options = {}) {
  const shared = options.shared || createShared(options);
  const app = express();

  app.disable('x-powered-by');

  app.use(requestIdMiddleware);
  app.use(responseTimeMiddleware);
  app.use(
    pinoHttp({
      logger,
      customProps: (req) => ({ requestId: req.requestId }),
      customErrorMessage: (_req, _res, err) =>
        err ? err.message : 'Request completed with error status',
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (typeof options.applyMiddleware === 'function') {
    options.applyMiddleware(app);
  }

  app.use(createRootRouter(shared));

  setupSwagger(app);

  app.use(notFoundHandler);
  app.use(createErrorMiddleware(logger, config.isProduction));

  return app;
}

export default createApp;
