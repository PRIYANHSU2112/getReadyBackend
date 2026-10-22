import 'express-async-errors';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { createHttpLogger, logger } from '@getready/logger';
import { correlationMiddleware } from '@getready/tracing';
import { createMetricsMiddleware, metricsEndpointHandler } from '@getready/metrics';
import { ApiResponse, HttpStatus, ErrorCodes } from '@getready/errors';
import { config } from './config/index.js';
import { mongooseConnection } from './database/index.js';

import { MembershipRepository } from './repositories/membership.repository.js';
import { MembershipService } from './services/membership.service.js';
import { MembershipController } from './controllers/membership.controller.js';
import {
  createMembershipRoutes,
  createAdminMembershipRoutes,
} from './routes/membership.routes.js';

export function createApp(deps = {}) {
  const app = express();
  app.disable('x-powered-by');

  app.use(correlationMiddleware);
  app.use(createHttpLogger());
  app.use(createMetricsMiddleware('membership-service'));

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));

  // Health checks
  app.get('/health', (req, res) => {
    return ApiResponse.success(
      res,
      {
        status: 'ok',
        service: 'membership-service',
        timestamp: new Date().toISOString(),
      },
      'Membership Service is healthy',
    );
  });

  if (config.metricsEnabled) {
    app.get('/metrics', metricsEndpointHandler());
  }

  // DI Wiring
  const membershipRepo = deps.membershipRepository || new MembershipRepository();
  const membershipService =
    deps.membershipService || new MembershipService(membershipRepo, deps.eventPublisher || null);
  const membershipCtrl = new MembershipController(membershipService);

  // Mount routes
  app.use('/api/v1/memberships', createMembershipRoutes(membershipCtrl));
  app.use('/api/v1/admin/memberships', createAdminMembershipRoutes(membershipCtrl));

  // 404
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
    logger.error({ err, url: req.originalUrl, correlationId: req.correlationId }, 'Membership Service Error');
    const statusCode = err.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
    const message = process.env.NODE_ENV === 'production' && statusCode === 500 ? 'Internal server error' : err.message;
    return ApiResponse.error(
      res,
      message,
      statusCode,
      err.code || ErrorCodes.INTERNAL_ERROR,
      err.details,
      req.requestId,
    );
  });

  return app;
}

export default createApp;
