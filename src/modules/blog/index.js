import { BlogModel } from './blog.model.js';
import { BlogRepository } from './blog.repository.js';
import { BlogService } from './blog.service.js';
import { BlogController } from './blog.controller.js';
import { createBlogRoutes } from './blog.routes.js';
import { blogDocs } from './blog.docs.js';

/**
 * Blog module — public home/list/detail + likes; admin CRUD with Category ref.
 * @param {{
 *   authenticate: Function,
 *   checkPermission: Function,
 *   cacheService?: object|null,
 *   storageService?: object|null,
 *   categoryRepository?: object|null,
 * }} deps
 */
export function createBlogModule({
  authenticate,
  checkPermission,
  cacheService = null,
  storageService = null,
  categoryRepository = null,
}) {
  const repository = new BlogRepository(BlogModel);
  const service = new BlogService(
    repository,
    categoryRepository,
    cacheService,
    storageService,
  );
  const controller = new BlogController(service);

  return {
    service,
    repository,
    routes: createBlogRoutes(controller, { authenticate, checkPermission }),
    docs: blogDocs,
  };
}

export { blogDocs } from './blog.docs.js';
export { blogValidator } from './blog.validation.js';
export { BlogModel } from './blog.model.js';
