import { BaseController } from '../../common/base/BaseController.js';

export class SlotController extends BaseController {
  /**
   * @param {import('./slot.service.js').SlotService} slotService
   */
  constructor(slotService) {
    super();
    this.slotService = slotService;
    this.bindMethods([
      'create',
      'createBulk',
      'update',
      'remove',
      'list',
      'getById',
      'listAvailable',
    ]);
  }

  async create(req, res) {
    const slot = await this.slotService.create(req.body, req.user?.id);
    return this.created(res, slot);
  }

  async createBulk(req, res) {
    const slots = await this.slotService.createBulk(req.body.slots, req.user?.id);
    return this.created(res, slots);
  }

  async update(req, res) {
    const slot = await this.slotService.update(req.params.id, req.body, req.user?.id);
    return this.ok(res, slot);
  }

  async remove(req, res) {
    const slot = await this.slotService.remove(req.params.id, req.user?.id);
    return this.ok(res, slot);
  }

  async list(req, res) {
    const { items, meta } = await this.slotService.list(req.query);
    return this.ok(res, items, meta);
  }

  async getById(req, res) {
    const slot = await this.slotService.getById(req.params.id);
    return this.ok(res, slot);
  }

  async listAvailable(req, res) {
    const data = await this.slotService.listAvailableByDate(req.query.date);
    return this.ok(res, data);
  }
}
