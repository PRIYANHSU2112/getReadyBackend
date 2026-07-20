import { Router } from 'express';
import { healthController } from '../core/health/health.controller.js';
import { asyncHandler } from '../common/utils/asyncHandler.js';
import { register } from '../core/monitoring/metrics.js';
import config from '../core/config/index.js';
import { createUserModule } from '../modules/user/index.js';
import { createNotificationModule } from '../modules/notification/index.js';


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

  // --- Module-local DI: each feature wires Repository → Service → Controller ---
  const user = createUserModule({
    eventBus: shared.eventBus,
    cacheService: shared.cacheService,
    jwtUtil: shared.jwtUtil,
    authenticate: shared.authenticate,
  });

  const notification = createNotificationModule({
    eventBus: shared.eventBus,
    authenticate: shared.authenticate,
  });
  notification.registerEvents(shared.eventBus);

  const v1 = Router();
  v1.use('/users', user.routes);
  v1.use('/notifications', notification.routes);
  router.use('/api/v1', v1);

  return router;
}
