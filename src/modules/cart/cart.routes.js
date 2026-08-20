import { Router } from 'express';
import { validate } from '../../common/middleware/validate.middleware.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { cartValidator } from './cart.validation.js';

/**
 * Auth-only cart routes — no RBAC permission checks.
 * Ownership is enforced in CartService via req.user.id.
 *
 * @param {import('./cart.controller.js').CartController} cartController
 * @param {{ authenticate: Function }} guards
 */
export function createCartRoutes(cartController, guards) {
  const router = Router();

  router.use(guards.authenticate);

  router.get('/', asyncHandler(cartController.getCart));

  router.delete('/', asyncHandler(cartController.clear));

  router.post(
    '/sync',
    validate(cartValidator, 'syncCart'),
    asyncHandler(cartController.syncCart),
  );

  router.patch(
    '/hygiene-kit',
    validate(cartValidator, 'updateHygieneKit'),
    asyncHandler(cartController.updateHygieneKit),
  );

  router.post(
    '/book-for-others',
    validate(cartValidator, 'bookForOthers'),
    asyncHandler(cartController.bookForOthers),
  );


  router.post(
    '/items',
    validate(cartValidator, 'addCartItem'),
    asyncHandler(cartController.addItem),
  );

  router.patch(
    '/items/:lineId',
    validate(cartValidator, 'lineIdParams', 'params'),
    validate(cartValidator, 'updateCartItemQuantity'),
    asyncHandler(cartController.updateItemQuantity),
  );

  router.delete(
    '/items/:lineId',
    validate(cartValidator, 'lineIdParams', 'params'),
    asyncHandler(cartController.removeItem),
  );

  router.patch(
    '/items/:lineId/selections',
    validate(cartValidator, 'lineIdParams', 'params'),
    validate(cartValidator, 'updatePackageSelections'),
    asyncHandler(cartController.updatePackageSelections),
  );

  router.patch(
    '/items/:lineId/recipient',
    validate(cartValidator, 'lineIdParams', 'params'),
    validate(cartValidator, 'updateRecipient'),
    asyncHandler(cartController.updateRecipient),
  );

  router.patch(
    '/instructions',
    validate(cartValidator, 'updateInstructions'),
    asyncHandler(cartController.updateInstructions),
  );

  router.patch(
    '/benefits',
    validate(cartValidator, 'updateBenefits'),
    asyncHandler(cartController.updateBenefits),
  );

  return router;
}
