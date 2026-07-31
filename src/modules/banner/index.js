import { BannerModel } from './banner.model.js';
import { BannerRepository } from './banner.repository.js';
import { BannerService } from './banner.service.js';
import { BannerController } from './banner.controller.js';
import { createBannerRoutes } from './banner.routes.js';
import { bannerDocs } from './banner.docs.js';

/**
 * Banner module factory — public active list + RBAC admin CRUD + image upload.
 * @param {{
 *   authenticate: Function,
 *   checkPermission: Function,
 *   cacheService?: object|null,
 *   storageService?: object|null,
 *   categoryRepository?: object|null,
 * }} deps
 */
export function createBannerModule({
  authenticate,
  checkPermission,
  cacheService = null,
  storageService = null,
  categoryRepository = null,
}) {
  const repository = new BannerRepository(BannerModel);
  const service = new BannerService(
    repository,
    cacheService,
    storageService,
    categoryRepository,
  );
  const controller = new BannerController(service);

  return {
    service,
    routes: createBannerRoutes(controller, { authenticate, checkPermission }),
    docs: bannerDocs,
  };
}

export { bannerDocs } from './banner.docs.js';
export { bannerValidator } from './banner.validation.js';
export { BannerModel } from './banner.model.js';
