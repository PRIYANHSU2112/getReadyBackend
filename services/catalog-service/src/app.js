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
  CategoryRepository,
  ServiceRepository,
  ServiceChangeRequestRepository,
  PackageRepository,
  FilterRepository,
  HygieneKitRepository,
  CouponRepository,
} from './repositories/catalog.repositories.js';

import {
  CategoryService,
  CatalogItemService,
  PackageService,
  FilterService,
  HygieneKitService,
  CouponService,
  StorageService,
} from './services/catalog.services.js';

import {
  CategoryController,
  ServiceController,
  PackageController,
  FilterController,
  HygieneKitController,
  CouponController,
} from './controllers/catalog.controllers.js';

import {
  createCategoryRoutes,
  createServiceRoutes,
  createServiceChangeRequestRoutes,
  createPackageRoutes,
  createFilterRoutes,
  createHygieneKitRoutes,
  createCouponRoutes,
} from './routes/catalog.routes.js';

export function createApp(deps = {}) {
  const app = express();
  app.disable('x-powered-by');

  app.use(correlationMiddleware);
  app.use(createHttpLogger());
  app.use(createMetricsMiddleware('catalog-service'));

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health & Readiness
  app.get('/health', (_req, res) => {
    return ApiResponse.success(res, {
      status: 'healthy',
      service: 'catalog-service',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/ready', (_req, res) => {
    if (!mongooseConnection.isReady()) {
      return ApiResponse.error(res, 'Database not ready', HttpStatus.SERVICE_UNAVAILABLE);
    }
    return ApiResponse.success(res, { status: 'ready', service: 'catalog-service' });
  });

  if (config.metricsEnabled) {
    app.get('/metrics', metricsEndpointHandler());
  }

  // DI Wiring
  const categoryRepo = deps.categoryRepository || new CategoryRepository();
  const serviceRepo = deps.serviceRepository || new ServiceRepository();
  const changeRequestRepo = deps.changeRequestRepository || new ServiceChangeRequestRepository();
  const packageRepo = deps.packageRepository || new PackageRepository();
  const filterRepo = deps.filterRepository || new FilterRepository();
  const hygieneKitRepo = deps.hygieneKitRepository || new HygieneKitRepository();
  const couponRepo = deps.couponRepository || new CouponRepository();
  const storageService = deps.storageService || new StorageService(config.storage, config.appUrl);

  const categoryService = deps.categoryService || new CategoryService(categoryRepo, storageService, deps.eventPublisher || null);
  const catalogItemService = deps.catalogItemService || new CatalogItemService(serviceRepo, changeRequestRepo, categoryRepo, storageService, deps.eventPublisher || null);
  const packageService = deps.packageService || new PackageService(packageRepo, storageService, deps.eventPublisher || null);
  const filterService = deps.filterService || new FilterService(filterRepo);
  const hygieneKitService = deps.hygieneKitService || new HygieneKitService(hygieneKitRepo, storageService, deps.eventPublisher || null);
  const couponService = deps.couponService || new CouponService(couponRepo, deps.eventPublisher || null);

  const categoryCtrl = new CategoryController(categoryService);
  const serviceCtrl = new ServiceController(catalogItemService);
  const packageCtrl = new PackageController(packageService);
  const filterCtrl = new FilterController(filterService);
  const hygieneKitCtrl = new HygieneKitController(hygieneKitService);
  const couponCtrl = new CouponController(couponService);

  // Mount routes
  app.use('/api/v1/categories', createCategoryRoutes(categoryCtrl));
  app.use('/api/v1/services', createServiceRoutes(serviceCtrl));
  app.use('/api/v1/service-change-requests', createServiceChangeRequestRoutes(serviceCtrl));
  app.use('/api/v1/packages', createPackageRoutes(packageCtrl));
  app.use('/api/v1/filters', createFilterRoutes(filterCtrl));
  app.use('/api/v1/hygiene-kits', createHygieneKitRoutes(hygieneKitCtrl));
  app.use('/api/v1/coupons', createCouponRoutes(couponCtrl));

  // 404
  app.use((req, res) => {
    return ApiResponse.error(res, `Cannot ${req.method} ${req.originalUrl}`, HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  });

  // Global Error Handler
  app.use((err, req, res, _next) => {
    logger.error({ err, url: req.originalUrl, correlationId: req.correlationId }, 'Catalog Service Error');
    const statusCode = err.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
    const message = config.isProduction && statusCode === 500 ? 'Internal server error' : err.message;
    return ApiResponse.error(res, message, statusCode, err.code || ErrorCodes.INTERNAL_ERROR, err.details, req.requestId);
  });

  return app;
}

export default createApp;
