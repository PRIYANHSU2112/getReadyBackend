import { Router } from 'express';
import { healthController } from '../core/health/health.controller.js';
import { asyncHandler } from '../common/utils/asyncHandler.js';
import { register } from '../core/monitoring/metrics.js';
import config from '../core/config/index.js';
import { createUserModule } from '../modules/user/index.js';
import { createAuthModule } from '../modules/auth/index.js';
import { createNotificationModule } from '../modules/notification/index.js';
import { createRbacModule } from '../modules/rbac/index.js';
import { createAddressModule } from '../modules/address/index.js';
import { createBannerModule } from '../modules/banner/index.js';
import { createFilterModule } from '../modules/filter/index.js';

export function createRootRouter(shared) {
  const router = Router();

  router.get('/health', (req, res) => healthController.health(req, res));
  router.get('/ready', asyncHandler((req, res) => healthController.ready(req, res)));

  if (config.metricsEnabled) {
    router.get('/metrics', async (_req, res) => {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    });
  }

  const rbac = createRbacModule({
    authenticate: shared.authenticate,
    cacheService: shared.cacheService,
  });

  const user = createUserModule({
    eventBus: shared.eventBus,
    cacheService: shared.cacheService,
    storageService: shared.storageService,
    authenticate: shared.authenticate,
    checkPermission: rbac.checkPermission,
    roleService: rbac.service,
  });

  rbac.service.bindCountUsersByRole((slug) => user.service.countByRole(slug));

  const auth = createAuthModule({
    userService: user.service,
    jwtUtil: shared.jwtUtil,
    cacheService: shared.cacheService,
    authenticate: shared.authenticate,
  });

  const notification = createNotificationModule({
    eventBus: shared.eventBus,
    authenticate: shared.authenticate,
  });
  notification.registerEvents(shared.eventBus);

  const address = createAddressModule({
    authenticate: shared.authenticate,
    cacheService: shared.cacheService,
  });

  const banner = createBannerModule({
    authenticate: shared.authenticate,
    checkPermission: rbac.checkPermission,
    cacheService: shared.cacheService,
    storageService: shared.storageService,
  });

  const filter = createFilterModule({
    authenticate: shared.authenticate,
    checkPermission: rbac.checkPermission,
    cacheService: shared.cacheService,
    storageService: shared.storageService,
  });

  const v1 = Router();
  v1.use('/auth', auth.routes);
  v1.use('/users', user.routes);
  v1.use('/roles', rbac.roleRoutes);
  v1.use('/permissions', rbac.permissionRoutes);
  v1.use('/notifications', notification.routes);
  v1.use('/addresses', address.routes);
  v1.use('/banners', banner.routes);
  v1.use('/filters', filter.routes);
  router.use('/api/v1', v1);

  return router;
}
