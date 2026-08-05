import { PackageModel, PackageChangeRequestModel } from './package.model.js';
import { PackageRepository } from './package.repository.js';
import { PackageService } from './package.service.js';
import { PackageController } from './package.controller.js';
import { createPackageRoutes } from './package.routes.js';
import { packageDocs } from './package.docs.js';

/**
 * @param {{ categoryRepository: object, eventBus?: object, cacheService?: object, authenticate: Function }} deps
 */
export function createPackageModule({ categoryRepository, eventBus, cacheService, authenticate }) {
  const repository = new PackageRepository(PackageModel, PackageChangeRequestModel);
  const service = new PackageService(repository, categoryRepository, eventBus, cacheService);
  const controller = new PackageController(service);

  return {
    repository,
    service,
    routes: createPackageRoutes(controller, { authenticate }),
    docs: packageDocs,
  };
}

export { packageDocs } from './package.docs.js';
export { packageValidator } from './package.validation.js';
