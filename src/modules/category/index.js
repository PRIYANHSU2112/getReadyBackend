import { CategoryModel } from './category.model.js';
import { CategoryRepository } from './category.repository.js';
import { CategoryService } from './category.service.js';
import { CategoryController } from './category.controller.js';
import { createCategoryRoutes } from './category.routes.js';
import { categoryDocs } from './category.docs.js';

/**
 * Category module factory — public slim list + staff read + RBAC admin CRUD + image upload.
 * @param {{
 *   authenticate: Function,
 *   checkPermission: Function,
 *   cacheService?: object|null,
 *   storageService?: object|null,
 * }} deps
 */
export function createCategoryModule({
  authenticate,
  checkPermission,
  cacheService = null,
  storageService = null,
}) {
  const repository = new CategoryRepository(CategoryModel);
  const service = new CategoryService(repository, cacheService, storageService);
  const controller = new CategoryController(service);

  return {
    repository,
    service,
    routes: createCategoryRoutes(controller, { authenticate, checkPermission }),
    docs: categoryDocs,
  };
}

export { categoryDocs } from './category.docs.js';
export { categoryValidator } from './category.validation.js';
export { CategoryModel } from './category.model.js';
export { CategoryRepository } from './category.repository.js';
