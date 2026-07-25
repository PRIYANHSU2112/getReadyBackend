import { BaseController } from '../../common/base/BaseController.js';

export class BannerController extends BaseController {
  /**
   * @param {import('./banner.service.js').BannerService} bannerService
   */
  constructor(bannerService) {
    super();
    this.bannerService = bannerService;
    this.bindMethods(['listActive', 'list', 'getById', 'create', 'update', 'remove']);
  }

  async listActive(req, res) {
    const { items, meta } = await this.bannerService.listActive(req.query);
    return this.ok(res, items, meta);
  }

  async list(req, res) {
    const { items, meta } = await this.bannerService.list(req.query);
    return this.ok(res, items, meta);
  }

  async getById(req, res) {
    const banner = await this.bannerService.getById(req.params.id);
    return this.ok(res, banner);
  }

  async create(req, res) {
    const banner = await this.bannerService.create(req.body, req.file || null);
    return this.created(res, banner);
  }

  async update(req, res) {
    const banner = await this.bannerService.update(
      req.params.id,
      req.body,
      req.file || null,
    );
    return this.ok(res, banner);
  }

  async remove(req, res) {
    await this.bannerService.remove(req.params.id);
    return this.noContent(res);
  }
}
