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
import { createCategoryModule } from '../modules/category/index.js';
import { createServiceModule } from '../modules/service/index.js';
import { createPackageModule } from '../modules/package/index.js';
import { createSkillModule } from '../modules/skill/index.js';
import { createBeauticianProfileModule } from '../modules/beautician-profile/index.js';
import { createBankDetailModule } from '../modules/bank-detail/index.js';
import { createCartModule } from '../modules/cart/index.js';
import { createMemberModule } from '../modules/member/index.js';
import { createSlotModule } from '../modules/slot/index.js';
import { createBlogModule } from '../modules/blog/index.js';

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

  // Seed permissions and sync system role default permissions (Admin, Beautician) on boot
  rbac.service.seedDefaults().catch(() => {});

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

  const category = createCategoryModule({
    authenticate: shared.authenticate,
    checkPermission: rbac.checkPermission,
    cacheService: shared.cacheService,
    storageService: shared.storageService,
  });

  const serviceModule = createServiceModule({
    authenticate: shared.authenticate,
    checkPermission: rbac.checkPermission,
    cacheService: shared.cacheService,
    storageService: shared.storageService,
    categoryRepository: category.repository,
  });

  const packageModule = createPackageModule({
    authenticate: shared.authenticate,
    eventBus: shared.eventBus,
    cacheService: shared.cacheService,
    categoryRepository: category.repository,
  });

  const banner = createBannerModule({
    authenticate: shared.authenticate,
    checkPermission: rbac.checkPermission,
    cacheService: shared.cacheService,
    storageService: shared.storageService,
    categoryRepository: category.repository,
  });

  const filter = createFilterModule({
    authenticate: shared.authenticate,
    checkPermission: rbac.checkPermission,
    cacheService: shared.cacheService,
    storageService: shared.storageService,
  });

  const skill = createSkillModule({
    authenticate: shared.authenticate,
    checkPermission: rbac.checkPermission,
    cacheService: shared.cacheService,
  });

  const beauticianProfile = createBeauticianProfileModule({
    authenticate: shared.authenticate,
    checkPermission: rbac.checkPermission,
    cacheService: shared.cacheService,
    storageService: shared.storageService,
  });

  const bankDetail = createBankDetailModule({
    authenticate: shared.authenticate,
    checkPermission: rbac.checkPermission,
    cacheService: shared.cacheService,
    storageService: shared.storageService,
    beauticianProfileRepository: beauticianProfile.profileRepo,
  });

  const member = createMemberModule({
    authenticate: shared.authenticate,
    cacheService: shared.cacheService,
  });

  const cart = createCartModule({
    authenticate: shared.authenticate,
    cacheService: shared.cacheService,
    serviceRepository: serviceModule.repository,
    packageRepository: packageModule.repository,
    memberRepository: member.repository,
  });

  const slot = createSlotModule({
    authenticate: shared.authenticate,
    checkPermission: rbac.checkPermission,
    cacheService: shared.cacheService,
    slotInventory: shared.slotInventory || null,
  });

  const blog = createBlogModule({
    authenticate: shared.authenticate,
    checkPermission: rbac.checkPermission,
    cacheService: shared.cacheService,
    storageService: shared.storageService,
    categoryRepository: category.repository,
  });

  // Mount API V1 Routes
  const apiV1 = Router();
  apiV1.use('/auth', auth.routes);
  apiV1.use('/users', user.routes);
  apiV1.use('/notifications', notification.routes);
  apiV1.use('/roles', rbac.roleRoutes);
  apiV1.use('/permissions', rbac.permissionRoutes);
  apiV1.use('/addresses', address.routes);
  apiV1.use('/banners', banner.routes);
  apiV1.use('/filters', filter.routes);
  apiV1.use('/categories', category.routes);
  apiV1.use('/services', serviceModule.routes);
  apiV1.use('/service-change-requests', serviceModule.changeRequestRoutes);
  apiV1.use('/packages', packageModule.routes);
  apiV1.use('/skills', skill.routes);
  apiV1.use('/beautician-profiles', beauticianProfile.routes);
  apiV1.use('/bank-details', bankDetail.routes);
  apiV1.use('/members', member.routes);
  apiV1.use('/cart', cart.routes);
  apiV1.use('/slots', slot.routes);
  apiV1.use('/blogs', blog.routes);

  router.use('/api/v1', apiV1);

  return router;
}
