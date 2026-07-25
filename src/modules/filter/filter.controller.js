import { BaseController } from '../../common/base/BaseController.js';

export class FilterController extends BaseController {
  /**
   * @param {import('./filter.service.js').FilterService} filterService
   */
  constructor(filterService) {
    super();
    this.filterService = filterService;
    this.bindMethods([
      'listPublic',
      'list',
      'getById',
      'create',
      'update',
      'remove',
      'restore',
      'setStatus',
      'reorder',
      'bulkSetStatus',
      'bulkDelete',
      'listValues',
      'createValue',
      'updateValue',
      'removeValue',
      'restoreValue',
      'reorderValues',
    ]);
  }

  async listPublic(req, res) {
    const data = await this.filterService.listPublic(req.query);
    return this.ok(res, data);
  }

  async list(req, res) {
    const { items, meta } = await this.filterService.list(req.query);
    return this.ok(res, items, meta);
  }

  async getById(req, res) {
    const includeValues =
      req.query.includeValues === true || req.query.includeValues === 'true';
    const filter = await this.filterService.getById(req.params.id, { includeValues });
    return this.ok(res, filter);
  }

  async create(req, res) {
    const filter = await this.filterService.create(
      req.body,
      req.user?.id,
      req.file || null,
    );
    return this.created(res, filter);
  }

  async update(req, res) {
    const filter = await this.filterService.update(
      req.params.id,
      req.body,
      req.user?.id,
      req.file || null,
    );
    return this.ok(res, filter);
  }

  async remove(req, res) {
    await this.filterService.remove(req.params.id, req.user?.id);
    return this.noContent(res);
  }

  async restore(req, res) {
    const filter = await this.filterService.restore(req.params.id, req.user?.id);
    return this.ok(res, filter);
  }

  async setStatus(req, res) {
    const filter = await this.filterService.setStatus(
      req.params.id,
      req.body.isActive,
      req.user?.id,
    );
    return this.ok(res, filter);
  }

  async reorder(req, res) {
    await this.filterService.reorder(req.body.items);
    return this.ok(res, { reordered: true });
  }

  async bulkSetStatus(req, res) {
    await this.filterService.bulkSetStatus(req.body.ids, req.body.isActive);
    return this.ok(res, { updated: true });
  }

  async bulkDelete(req, res) {
    await this.filterService.bulkDelete(req.body.ids);
    return this.ok(res, { deleted: true });
  }

  async listValues(req, res) {
    const { items, meta } = await this.filterService.listValues(
      req.params.filterId,
      req.query,
    );
    return this.ok(res, items, meta);
  }

  async createValue(req, res) {
    const value = await this.filterService.createValue(
      req.params.filterId,
      req.body,
      req.user?.id,
      req.file || null,
    );
    return this.created(res, value);
  }

  async updateValue(req, res) {
    const value = await this.filterService.updateValue(
      req.params.filterId,
      req.params.valueId,
      req.body,
      req.user?.id,
      req.file || null,
    );
    return this.ok(res, value);
  }

  async removeValue(req, res) {
    await this.filterService.removeValue(req.params.filterId, req.params.valueId);
    return this.noContent(res);
  }

  async restoreValue(req, res) {
    const value = await this.filterService.restoreValue(
      req.params.filterId,
      req.params.valueId,
    );
    return this.ok(res, value);
  }

  async reorderValues(req, res) {
    await this.filterService.reorderValues(req.params.filterId, req.body.items);
    return this.ok(res, { reordered: true });
  }
}
