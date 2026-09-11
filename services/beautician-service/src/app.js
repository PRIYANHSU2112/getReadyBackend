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

import {
  BeauticianProfileRepository,
  WorkHistoryRepository,
  CertificateRepository,
  SkillRepository,
  BankDetailRepository,
} from './repositories/beautician.repositories.js';

import {
  BeauticianProfileService,
  SkillService,
  BankDetailService,
} from './services/beautician.services.js';
import { StorageService } from '@getready/storage';

import { UserClient } from './services/user-client.js';

import {
  BeauticianProfileController,
  SkillController,
  BankDetailController,
} from './controllers/beautician.controllers.js';

import {
  createBeauticianProfileRoutes,
  createSkillRoutes,
  createBankDetailRoutes,
} from './routes/beautician.routes.js';

export function createApp(deps = {}) {
  const app = express();
  app.disable('x-powered-by');

  app.use(correlationMiddleware);
  app.use(createHttpLogger());
  app.use(createMetricsMiddleware('beautician-service'));

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health & Readiness
  app.get('/health', (_req, res) => {
    return ApiResponse.success(res, {
      status: 'healthy',
      service: 'beautician-service',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/ready', (_req, res) => {
    if (!mongooseConnection.isReady()) {
      return ApiResponse.error(res, 'Database not ready', HttpStatus.SERVICE_UNAVAILABLE);
    }
    return ApiResponse.success(res, { status: 'ready', service: 'beautician-service' });
  });

  if (config.metricsEnabled) {
    app.get('/metrics', metricsEndpointHandler());
  }

  // Repositories & Services
  const profileRepo = deps.profileRepository || new BeauticianProfileRepository();
  const workHistoryRepo = deps.workHistoryRepository || new WorkHistoryRepository();
  const certRepo = deps.certificateRepository || new CertificateRepository();
  const skillRepo = deps.skillRepository || new SkillRepository();
  const bankRepo = deps.bankDetailRepository || new BankDetailRepository();
  const storageService = deps.storageService || new StorageService(config.storage || {});
  const userClient = deps.userClient || new UserClient(config.userServiceUrl);

  const profileService =
    deps.profileService ||
    new BeauticianProfileService(
      profileRepo,
      workHistoryRepo,
      certRepo,
      bankRepo,
      storageService,
      userClient,
      deps.eventPublisher || null,
    );
  const skillService = deps.skillService || new SkillService(skillRepo, deps.eventPublisher || null);
  const bankDetailService =
    deps.bankDetailService || new BankDetailService(bankRepo, profileRepo, storageService);

  const profileCtrl = new BeauticianProfileController(profileService);
  const skillCtrl = new SkillController(skillService);
  const bankCtrl = new BankDetailController(bankDetailService);

  // Mount routes
  const beauticianRoutes = createBeauticianProfileRoutes(profileCtrl);
  app.use('/api/v1/beautician-profiles', beauticianRoutes);
  app.use('/api/v1/beauticians', beauticianRoutes);
  app.use('/api/v1/skills', createSkillRoutes(skillCtrl));
  app.use('/api/v1/bank-details', createBankDetailRoutes(bankCtrl));

  // 404
  app.use((req, res) => {
    return ApiResponse.error(res, `Cannot ${req.method} ${req.originalUrl}`, HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  });

  // Global Error Handler
  app.use((err, req, res, _next) => {
    logger.error({ err, url: req.originalUrl, correlationId: req.correlationId }, 'Beautician Service Error');
    const statusCode = err.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
    const message = config.isProduction && statusCode === 500 ? 'Internal server error' : err.message;
    return ApiResponse.error(res, message, statusCode, err.code || ErrorCodes.INTERNAL_ERROR, err.details, req.requestId);
  });

  return app;
}

export default createApp;
