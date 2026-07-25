import { FilterModel } from './filter.model.js';
import { FilterValueModel } from './filter-value.model.js';
import { FilterRepository } from './filter.repository.js';
import { FilterValueRepository } from './filter-value.repository.js';
import { FilterService } from './filter.service.js';
import { FilterController } from './filter.controller.js';
import { createFilterRoutes } from './filter.routes.js';
import { filterDocs } from './filter.docs.js';

/**
 * Filter module factory — public slim list + RBAC admin CRUD + image upload.
 * @param {{
 *   authenticate: Function,
 *   checkPermission: Function,
 *   cacheService?: object|null,
 *   storageService?: object|null,
 * }} deps
 */
export function createFilterModule({
  authenticate,
  checkPermission,
  cacheService = null,
  storageService = null,
}) {
  const filterRepository = new FilterRepository(FilterModel);
  const filterValueRepository = new FilterValueRepository(FilterValueModel);
  const service = new FilterService(
    filterRepository,
    filterValueRepository,
    cacheService,
    storageService,
  );
  const controller = new FilterController(service);

  return {
    service,
    routes: createFilterRoutes(controller, { authenticate, checkPermission }),
    docs: filterDocs,
  };
}

export { filterDocs } from './filter.docs.js';
export { filterValidator } from './filter.validation.js';
export { FilterModel } from './filter.model.js';
export { FilterValueModel } from './filter-value.model.js';
