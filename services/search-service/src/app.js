import 'express-async-errors';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { createHttpLogger, logger } from '@getready/logger';
import { correlationMiddleware } from '@getready/tracing';
import { createMetricsMiddleware, metricsEndpointHandler } from '@getready/metrics';
import { ApiResponse, HttpStatus, ErrorCodes } from '@getready/errors';
import { searchController } from './controllers/search.controller.js';
import { createSearchRoutes } from './routes/search.routes.js';

export function createApp(deps = {}) {
  const app = express();
  app.disable('x-powered-by');

  app.use(correlationMiddleware);
  app.use(createHttpLogger());
  app.use(createMetricsMiddleware('search-service'));

  app.use(cors({ origin: true, credentials: true }));
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));

  // Health / Readiness / Metrics
  app.get('/health', (_req, res) => {
    return ApiResponse.success(res, {
      status: 'healthy',
      service: 'search-service',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/ready', async (_req, res) => {
    return ApiResponse.success(res, {
      status: 'ready',
      service: 'search-service',
    });
  });

  app.get('/metrics', metricsEndpointHandler());

  // Mount Search Routes
  const ctrl = deps.searchController || searchController;
  app.use('/api/v1/search', createSearchRoutes(ctrl));

  // 404
  app.use((req, res) => {
    return ApiResponse.error(res, `Cannot ${req.method} ${req.originalUrl}`, HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  });

  // Global Error Handler
  app.use((err, req, res, _next) => {
    logger.error({ err, url: req.originalUrl, correlationId: req.correlationId }, 'Search Service Error');
    const statusCode = err.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
    const message = statusCode === 500 ? 'Internal search error' : err.message;
    return ApiResponse.error(res, message, statusCode, err.code || ErrorCodes.INTERNAL_ERROR, err.details, req.requestId);
  });

  return app;
}

export default createApp;
