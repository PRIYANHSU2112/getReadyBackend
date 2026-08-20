import { BaseController } from '../../common/base/BaseController.js';

export class HygieneKitController extends BaseController {
  /**
   * @param {import('./hygiene-kit.service.js').HygieneKitService} hygieneKitService
   */
  constructor(hygieneKitService) {
    super();
    this.hygieneKitService = hygieneKitService;
    this.bindMethods([
      'getDefault',
      'listActive',
      'list',
      'getById',
      'create',
      'update',
      'setDefault',
      'setStatus',
      'remove',
      'restore',
    ]);
  }

  async getDefault(req, res) {
    const kit = await this.hygieneKitService.getDefaultKit();
    return this.ok(res, kit);
  }

  async listActive(req, res) {
    const { items, meta } = await this.hygieneKitService.listActive(req.query);
    return this.ok(res, items, meta);
  }

  async list(req, res) {
    const { items, meta } = await this.hygieneKitService.list(req.query);
    return this.ok(res, items, meta);
  }

  async getById(req, res) {
    const kit = await this.hygieneKitService.getById(req.params.id);
    return this.ok(res, kit);
  }

  async create(req, res) {
    const kit = await this.hygieneKitService.create(req.body, req.file || null);
    return this.created(res, kit);
  }

  async update(req, res) {
    const kit = await this.hygieneKitService.update(
      req.params.id,
      req.body,
      req.file || null,
    );
    return this.ok(res, kit);
  }

  async setDefault(req, res) {
    const kit = await this.hygieneKitService.setDefault(req.params.id);
    return this.ok(res, kit);
  }

  async setStatus(req, res) {
    const kit = await this.hygieneKitService.setStatus(
      req.params.id,
      req.body.status,
    );
    return this.ok(res, kit);
  }

  async remove(req, res) {
    await this.hygieneKitService.remove(req.params.id);
    return this.noContent(res);
  }

  async restore(req, res) {
    const kit = await this.hygieneKitService.restore(req.params.id);
    return this.ok(res, kit);
  }
}
