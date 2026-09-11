import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { createHttpLogger, logger } from '@getready/logger';
import { correlationMiddleware } from '@getready/tracing';
import { createMetricsMiddleware, metricsEndpointHandler } from '@getready/metrics';
import { ApiResponse, HttpStatus, ErrorCodes } from '@getready/errors';
import { config } from './config/index.js';
import { gatewayIdentityMiddleware } from './middleware/auth.js';
import { createGatewayRouter } from './proxy/routes.js';
import { createUploadRouter } from './routes/upload.routes.js';
import { createSystemHealthRouter } from './routes/systemHealth.routes.js';
import { openapiSpec } from './docs/openapi.js';

export function createApp(deps = {}) {
  const app = express();
  app.disable('x-powered-by');

  // Tracing & Logging
  app.use(correlationMiddleware);
  app.use(createHttpLogger());
  app.use(createMetricsMiddleware('api-gateway'));

  // Security & Resilience
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
    }),
  );

  app.use(compression());

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 1000,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // Swagger Documentation
  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(openapiSpec);
  });
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(openapiSpec, {
      customSiteTitle: 'GetReady API Documentation',
      customCss: '.swagger-ui .topbar { display: none }',
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'list',
        filter: true,
      },
    }),
  );

  // Health & Metrics Endpoints
  app.get('/health', (_req, res) => {
    return ApiResponse.success(res, {
      status: 'healthy',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  app.get('/ready', async (_req, res) => {
    // Gateway is ready if the process is up
    return ApiResponse.success(res, {
      status: 'ready',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
    });
  });

  if (config.metricsEnabled) {
    app.get('/metrics', metricsEndpointHandler());
  }

  // Real-Time System Health Aggregator for Admin Monitoring Dashboard
  app.use('/health/system', createSystemHealthRouter());
  app.use('/api/v1/system/health', createSystemHealthRouter());

  // Identity Middleware
  app.use(gatewayIdentityMiddleware);

  // Central Upload Route (Presign & Direct Object Storage Upload)
  app.use('/api/v1/uploads', createUploadRouter());

  // Mount Downstream Microservice Proxies
  app.use(createGatewayRouter(deps.services || {}));

  // 404 Handler
  app.use((req, res) => {
    return ApiResponse.error(
      res,
      `Cannot ${req.method} ${req.originalUrl}`,
      HttpStatus.NOT_FOUND,
      ErrorCodes.NOT_FOUND,
    );
  });

  // Global Error Handler
  app.use((err, req, res, _next) => {
    logger.error({ err, url: req.originalUrl, correlationId: req.correlationId }, 'Unhandled Gateway Error');
    const statusCode = err.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
    const message = config.isProduction && statusCode === 500 ? 'Internal server error' : err.message;
    return ApiResponse.error(res, message, statusCode, err.code || ErrorCodes.INTERNAL_ERROR, err.details, req.requestId);
  });

  return app;
}

export default createApp;
