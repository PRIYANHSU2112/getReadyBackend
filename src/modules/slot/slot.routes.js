import { Router } from 'express';
import { validate } from '../../common/middleware/validate.middleware.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { slotValidator } from './slot.validation.js';

/**
 * Public available-by-date; admin CRUD behind authenticate + checkPermission.
 * Soft-hold lives on the future Booking/payment flow (not exposed here).
 *
 * @param {import('./slot.controller.js').SlotController} slotController
 * @param {{ authenticate?: Function, checkPermission?: Function }} [guards]
 */
export function createSlotRoutes(slotController, guards = {}) {
  const router = Router();
  const authenticate = guards.authenticate || ((_req, _res, next) => next());
  const checkPermission =
    guards.checkPermission || ((_req, _res, next) => next());

  router.get(
    '/available',
    validate(slotValidator, 'availableSlotsQuery', 'query'),
    asyncHandler(slotController.listAvailable),
  );

  router.use(authenticate, checkPermission);

  router.get(
    '/',
    validate(slotValidator, 'listSlotsQuery', 'query'),
    asyncHandler(slotController.list),
  );

  router.post(
    '/bulk',
    validate(slotValidator, 'createSlotsBulk'),
    asyncHandler(slotController.createBulk),
  );

  router.post(
    '/',
    validate(slotValidator, 'createSlot'),
    asyncHandler(slotController.create),
  );

  router.get(
    '/:id',
    validate(slotValidator, 'slotIdParams', 'params'),
    asyncHandler(slotController.getById),
  );

  router.patch(
    '/:id',
    validate(slotValidator, 'slotIdParams', 'params'),
    validate(slotValidator, 'updateSlot'),
    asyncHandler(slotController.update),
  );

  router.delete(
    '/:id',
    validate(slotValidator, 'slotIdParams', 'params'),
    asyncHandler(slotController.remove),
  );

  return router;
}
