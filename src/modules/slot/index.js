import { SlotModel } from './slot.model.js';
import { SlotRepository } from './slot.repository.js';
import { SlotService } from './slot.service.js';
import { SlotController } from './slot.controller.js';
import { createSlotRoutes } from './slot.routes.js';
import { createDefaultSlotInventory } from './slot.inventory.js';
import { slotDocs } from './slot.docs.js';

/**
 * Slot module — admin CRUD + public available-by-date.
 * Inventory hold helpers stay available for the future Booking/payment flow.
 * @param {{
 *   authenticate: Function,
 *   checkPermission: Function,
 *   cacheService?: object|null,
 *   slotInventory?: object|null,
 * }} deps
 */
export function createSlotModule({
  authenticate,
  checkPermission,
  cacheService = null,
  slotInventory = null,
}) {
  const repository = new SlotRepository(SlotModel);
  const inventory = slotInventory || createDefaultSlotInventory();
  const service = new SlotService(repository, inventory, cacheService);
  const controller = new SlotController(service);

  return {
    service,
    repository,
    routes: createSlotRoutes(controller, { authenticate, checkPermission }),
    docs: slotDocs,
  };
}

export { slotDocs } from './slot.docs.js';
export { slotValidator } from './slot.validation.js';
export { SlotModel } from './slot.model.js';
export { MemorySlotInventory, RedisSlotInventory } from './slot.inventory.js';
