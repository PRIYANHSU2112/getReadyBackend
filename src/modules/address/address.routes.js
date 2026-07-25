import { Router } from 'express';
import { validate } from '../../common/middleware/validate.middleware.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { addressValidator } from './address.validation.js';

/**
 * Auth-only address routes — no RBAC permission checks.
 * Ownership is enforced in AddressService.
 *
 * @param {import('./address.controller.js').AddressController} addressController
 * @param {{ authenticate: Function }} guards
 */
export function createAddressRoutes(addressController, guards) {
  const router = Router();

  router.use(guards.authenticate);

  router.get(
    '/',
    validate(addressValidator, 'listAddressesQuery', 'query'),
    asyncHandler(addressController.list),
  );

  router.post(
    '/',
    validate(addressValidator, 'createAddress'),
    asyncHandler(addressController.create),
  );

  router.get(
    '/:id',
    validate(addressValidator, 'addressIdParams', 'params'),
    asyncHandler(addressController.getById),
  );

  router.patch(
    '/:id',
    validate(addressValidator, 'addressIdParams', 'params'),
    validate(addressValidator, 'updateAddress'),
    asyncHandler(addressController.update),
  );

  router.delete(
    '/:id',
    validate(addressValidator, 'addressIdParams', 'params'),
    asyncHandler(addressController.remove),
  );

  router.put(
    '/:id/default',
    validate(addressValidator, 'addressIdParams', 'params'),
    asyncHandler(addressController.setDefault),
  );

  return router;
}
