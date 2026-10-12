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

  // Permitted CORS Origins (explicit whitelist + pattern matching for secure subdomains)
  const explicitAllowedOrigins = new Set([
    'https://admin.ready.deepent.in',
    'https://api.priyashu.in',
    'https://admin.getready.example.com',
    'https://www.getready.example.com',
    'https://getready-admin.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5000',
    ...(Array.isArray(config.corsOrigins)
      ? config.corsOrigins.map((o) => o.trim().replace(/\/+$/, ''))
      : []),
  ]);

  const corsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile native apps, React Native APK, curl, Postman, microservice IPC)
      if (!origin) {
        return callback(null, true);
      }

      const cleanOrigin = origin.trim().replace(/\/+$/, '');

      // Check explicit whitelist
      if (explicitAllowedOrigins.has(cleanOrigin)) {
        return callback(null, true);
      }

      // Allow trusted domain patterns (admin dashboard, mobile web, preview deployments)
      const isTrustedPattern =
        /^https?:\/\/([a-z0-9-]+\.)*ready\.deepent\.in$/i.test(cleanOrigin) ||
        /^https?:\/\/([a-z0-9-]+\.)*priyashu\.in$/i.test(cleanOrigin) ||
        /^https?:\/\/([a-z0-9-]+\.)*vercel\.app$/i.test(cleanOrigin) ||
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(cleanOrigin);

      if (isTrustedPattern) {
        return callback(null, true);
      }

      // Development / Non-production fallback
      if (!config.isProduction) {
        return callback(null, true);
      }

      logger.warn({ origin }, 'CORS request rejected: Origin not authorized');
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'x-correlation-id',
      'x-request-id',
      'x-user-id',
      'x-user-role',
      'x-user-email',
      'x-user-phone',
      'Range',
    ],
    exposedHeaders: [
      'x-correlation-id',
      'x-request-id',
      'Content-Range',
      'X-Total-Count',
      'Authorization',
    ],
    maxAge: 86400, // 24 hours preflight cache
    optionsSuccessStatus: 204,
  };

  // Mount CORS middleware & explicit preflight OPTIONS handler before rate limits
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

  // Security & Resilience
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
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
