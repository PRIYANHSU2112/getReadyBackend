import { BaseController } from '../../common/base/BaseController.js';

export class CategoryController extends BaseController {
  /**
   * @param {import('./category.service.js').CategoryService} categoryService
   */
  constructor(categoryService) {
    super();
    this.categoryService = categoryService;
    this.bindMethods([
      'listPublic',
      'getPublicBySlug',
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
    ]);
  }

  async listPublic(req, res) {
    const data = await this.categoryService.listPublic(req.query);
    return this.ok(res, data);
  }

  async getPublicBySlug(req, res) {
    const data = await this.categoryService.getPublicBySlug(req.params.slug);
    return this.ok(res, data);
  }

  async list(req, res) {
    const { items, meta } = await this.categoryService.list(req.query);
    return this.ok(res, items, meta);
  }

  async getById(req, res) {
    const category = await this.categoryService.getById(req.params.id);
    return this.ok(res, category);
  }

  async create(req, res) {
    const category = await this.categoryService.create(
      req.body,
      req.user?.id,
      req.file || null,
    );
    return this.created(res, category);
  }

  async update(req, res) {
    const category = await this.categoryService.update(
      req.params.id,
      req.body,
      req.user?.id,
      req.file || null,
    );
    return this.ok(res, category);
  }

  async remove(req, res) {
    await this.categoryService.remove(req.params.id, req.user?.id);
    return this.noContent(res);
  }

  async restore(req, res) {
    const category = await this.categoryService.restore(
      req.params.id,
      req.user?.id,
    );
    return this.ok(res, category);
  }

  async setStatus(req, res) {
    const category = await this.categoryService.setStatus(
      req.params.id,
      req.body.isActive,
      req.user?.id,
    );
    return this.ok(res, category);
  }

  async reorder(req, res) {
    await this.categoryService.reorder(req.body.items);
    return this.ok(res, { reordered: true });
  }

  async bulkSetStatus(req, res) {
    await this.categoryService.bulkSetStatus(req.body.ids, req.body.isActive);
    return this.ok(res, { updated: true });
  }

  async bulkDelete(req, res) {
    await this.categoryService.bulkDelete(req.body.ids);
    return this.ok(res, { deleted: true });
  }
}
