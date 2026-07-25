import { AddressModel } from './address.model.js';
import { AddressRepository } from './address.repository.js';
import { AddressService } from './address.service.js';
import { AddressController } from './address.controller.js';
import { createAddressRoutes } from './address.routes.js';
import { addressDocs } from './address.docs.js';

/**
 * Address module factory — auth-only (no RBAC permission checks).
 * @param {{
 *   authenticate: Function,
 *   cacheService?: object|null,
 * }} deps
 */
export function createAddressModule({ authenticate, cacheService = null }) {
  const repository = new AddressRepository(AddressModel);
  const service = new AddressService(repository, cacheService);
  const controller = new AddressController(service);

  return {
    service,
    routes: createAddressRoutes(controller, { authenticate }),
    docs: addressDocs,
  };
}

export { addressDocs } from './address.docs.js';
export { addressValidator } from './address.validation.js';
export { AddressModel } from './address.model.js';
