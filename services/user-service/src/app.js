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

import { UserRepository } from './repositories/user.repository.js';
import { AddressRepository } from './repositories/address.repository.js';
import { MemberRepository } from './repositories/member.repository.js';
import { RoleRepository, PermissionRepository } from './repositories/rbac.repository.js';

import { UserService } from './services/user.service.js';
import { AddressService } from './services/address.service.js';
import { MemberService } from './services/member.service.js';
import { RbacService } from './services/rbac.service.js';
import { StorageService } from '@getready/storage';

import { UserController } from './controllers/user.controller.js';
import { AddressController, MemberController, RbacController } from './controllers/sub.controllers.js';

import { createUserRoutes } from './routes/user.routes.js';
import { createAddressRoutes, createMemberRoutes, createRbacRoutes } from './routes/sub.routes.js';

export function createApp(deps = {}) {
  const app = express();
  app.disable('x-powered-by');

  app.use(correlationMiddleware);
  app.use(createHttpLogger());
  app.use(createMetricsMiddleware('user-service'));

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health & Readiness
  app.get('/health', (_req, res) => {
    return ApiResponse.success(res, {
      status: 'healthy',
      service: 'user-service',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/ready', (_req, res) => {
    if (!mongooseConnection.isReady()) {
      return ApiResponse.error(res, 'Database not ready', HttpStatus.SERVICE_UNAVAILABLE);
    }
    return ApiResponse.success(res, { status: 'ready', service: 'user-service' });
  });

  if (config.metricsEnabled) {
    app.get('/metrics', metricsEndpointHandler());
  }

  // DI Wiring
  const userRepo = deps.userRepository || new UserRepository();
  const addressRepo = deps.addressRepository || new AddressRepository();
  const memberRepo = deps.memberRepository || new MemberRepository();
  const roleRepo = deps.roleRepository || new RoleRepository();
  const permissionRepo = deps.permissionRepository || new PermissionRepository();

  const storageService = deps.storageService || new StorageService(config.storage || {});
  const rbacService = deps.rbacService || new RbacService(roleRepo, permissionRepo);
  const userService = deps.userService || new UserService(userRepo, storageService, rbacService, deps.eventPublisher || null);
  const addressService = deps.addressService || new AddressService(addressRepo, deps.eventPublisher || null);
  const memberService = deps.memberService || new MemberService(memberRepo, deps.eventPublisher || null);

  rbacService.bindCountUsersByRole((slug) => userService.countByRole(slug));

  const userController = new UserController(userService);
  const addressController = new AddressController(addressService);
  const memberController = new MemberController(memberService);
  const rbacController = new RbacController(rbacService);

  const { rolesRouter, permissionsRouter } = createRbacRoutes(rbacController);

  // Mount routes
  const memberRoutes = createMemberRoutes(memberController);
  app.use('/api/v1/users', createUserRoutes(userController));
  app.use('/api/v1/addresses', createAddressRoutes(addressController));
  app.use('/api/v1/members', memberRoutes);
  app.use('/api/v1/memberships', memberRoutes);
  app.use('/api/v1/customer-profiles', memberRoutes);
  app.use('/api/v1/roles', rolesRouter);
  app.use('/api/v1/permissions', permissionsRouter);
  app.use('/api/v1/referrals', memberRoutes);

  // 404
  app.use((req, res) => {
    return ApiResponse.error(res, `Cannot ${req.method} ${req.originalUrl}`, HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  });

  // Global Error Handler
  app.use((err, req, res, _next) => {
    logger.error({ err, url: req.originalUrl, correlationId: req.correlationId }, 'User Service Error');
    const statusCode = err.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
    const message = config.isProduction && statusCode === 500 ? 'Internal server error' : err.message;
    return ApiResponse.error(res, message, statusCode, err.code || ErrorCodes.INTERNAL_ERROR, err.details, req.requestId);
  });

  return { app, rbacService };
}

export default createApp;
