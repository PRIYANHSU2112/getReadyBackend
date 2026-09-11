import { Router } from 'express';
import { validate } from '@getready/validation';
import { cartValidator } from '../validators/cart.validation.js';

export function createCartRoutes(cartController) {
  const router = Router();

  router.get('/', cartController.getCart);
  router.delete('/', cartController.clear);
  router.post('/sync', validate(cartValidator.syncCart), cartController.syncCart);
  router.patch('/hygiene-kit', validate(cartValidator.updateHygieneKit), cartController.updateHygieneKit);
  router.post('/book-for-others', validate(cartValidator.bookForOthers), cartController.bookForOthers);

  router.post('/items', validate(cartValidator.addCartItem), cartController.addItem);
  router.patch('/items/:lineId', validate(cartValidator.lineIdParams, 'params'), validate(cartValidator.updateCartItemQuantity), cartController.updateItemQuantity);
  router.delete('/items/:lineId', validate(cartValidator.lineIdParams, 'params'), cartController.removeItem);
  router.patch('/items/:lineId/selections', validate(cartValidator.lineIdParams, 'params'), validate(cartValidator.updatePackageSelections), cartController.updatePackageSelections);
  router.patch('/items/:lineId/recipient', validate(cartValidator.lineIdParams, 'params'), validate(cartValidator.updateRecipient), cartController.updateRecipient);

  router.patch('/instructions', validate(cartValidator.updateInstructions), cartController.updateInstructions);
  router.patch('/benefits', validate(cartValidator.updateBenefits), cartController.updateBenefits);

  return router;
}
