import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { createHttpLogger, logger } from '@getready/logger';
import { correlationMiddleware } from '@getready/tracing';
import { createMetricsMiddleware, metricsEndpointHandler } from '@getready/metrics';
import { ApiResponse, HttpStatus, ErrorCodes } from '@getready/errors';
import { config } from './config/index.js';
import { createAuthRoutes } from './routes/auth.routes.js';
import { AuthController } from './controllers/auth.controller.js';
import { AuthService } from './services/auth.service.js';
import { OtpRepository } from './repositories/otp.repository.js';
import { RefreshTokenRepository } from './repositories/refresh-token.repository.js';
import { UserClient } from './services/user-client.js';
import { JwtService } from './services/jwt.service.js';
import { SmsService } from './services/sms.service.js';
import { mongooseConnection } from './database/index.js';

export function createApp(deps = {}) {
  const app = express();
  app.disable('x-powered-by');

  // Tracing, Logging, Metrics
  app.use(correlationMiddleware);
  app.use(createHttpLogger());
  app.use(createMetricsMiddleware('auth-service'));

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health & Readiness
  app.get('/health', (_req, res) => {
    return ApiResponse.success(res, {
      status: 'healthy',
      service: 'auth-service',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/ready', (_req, res) => {
    const isDbReady = mongooseConnection.isReady();
    if (!isDbReady) {
      return ApiResponse.error(
        res,
        'Auth Service not ready - Database connection down',
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCodes.SERVICE_UNAVAILABLE,
      );
    }
    return ApiResponse.success(res, {
      status: 'ready',
      service: 'auth-service',
      db: 'connected',
    });
  });

  if (config.metricsEnabled) {
    app.get('/metrics', metricsEndpointHandler());
  }

  // DI Wiring
  const otpRepo = deps.otpRepository || new OtpRepository(config);
  const refreshTokenRepo = deps.refreshTokenRepository || new RefreshTokenRepository();
  const userClient = deps.userClient || new UserClient(config.userServiceUrl);
  const jwtService =
    deps.jwtService ||
    new JwtService(
      config.jwt.secret,
      config.jwt.expiresIn,
      config.jwt.refreshSecret,
      config.jwt.refreshExpiresIn,
    );
  const smsService = deps.smsService || new SmsService(config.smsProvider);
  const authService =
    deps.authService ||
    new AuthService(
      otpRepo,
      refreshTokenRepo,
      userClient,
      jwtService,
      smsService,
      config,
      deps.eventPublisher || null,
    );

  const authController = new AuthController(authService);

  // Mount routes at /api/v1/auth
  app.use('/api/v1/auth', createAuthRoutes(authController));

  // 404
  app.use((req, res) => {
    return ApiResponse.error(res, `Cannot ${req.method} ${req.originalUrl}`, HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  });

  // Global Error Handler
  app.use((err, req, res, _next) => {
    logger.error({ err, url: req.originalUrl, correlationId: req.correlationId }, 'Auth Service Error');
    const statusCode = err.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
    const message = config.isProduction && statusCode === 500 ? 'Internal server error' : err.message;
    return ApiResponse.error(res, message, statusCode, err.code || ErrorCodes.INTERNAL_ERROR, err.details, req.requestId);
  });

  return app;
}

export default createApp;
