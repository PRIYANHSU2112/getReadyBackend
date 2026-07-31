import { BaseController } from '../../common/base/BaseController.js';

export class PackageController extends BaseController {
  constructor(packageService) {
    super();
    this.packageService = packageService;
    this.bindMethods([
      'create',
      'update',
      'approve',
      'reject',
      'approveChangeRequest',
      'rejectChangeRequest',
      'listPublic',
      'getPublicBySlug',
      'getPublicById',
      'listAdmin',
      'listChangeRequests',
      'delete',
    ]);
  }

  async create(req, res) {
    const result = await this.packageService.createPackage(req.body, req.user);
    return this.created(res, result);
  }

  async update(req, res) {
    const result = await this.packageService.updatePackage(req.params.id, req.body, req.user);
    return this.ok(res, result);
  }

  async approve(req, res) {
    const result = await this.packageService.approvePackage(req.params.id, req.body, req.user);
    return this.ok(res, result);
  }

  async reject(req, res) {
    const result = await this.packageService.rejectPackage(req.params.id, req.body, req.user);
    return this.ok(res, result);
  }

  async approveChangeRequest(req, res) {
    const result = await this.packageService.approveChangeRequest(req.params.id, req.user);
    return this.ok(res, result);
  }

  async rejectChangeRequest(req, res) {
    const result = await this.packageService.rejectChangeRequest(req.params.id, req.body, req.user);
    return this.ok(res, result);
  }

  async listPublic(req, res) {
    const result = await this.packageService.listPublic(req.query);
    return this.ok(res, result.items, result.meta);
  }

  async getPublicBySlug(req, res) {
    const result = await this.packageService.getPublicBySlug(req.params.slug);
    return this.ok(res, result);
  }

  async getPublicById(req, res) {
    const result = await this.packageService.getPublicById(req.params.id);
    return this.ok(res, result);
  }

  async listAdmin(req, res) {
    const result = await this.packageService.listAdmin(req.query);
    return this.ok(res, result.items, result.meta);
  }

  async listChangeRequests(req, res) {
    const result = await this.packageService.listChangeRequests(req.query);
    return this.ok(res, result.items, result.meta);
  }

  async delete(req, res) {
    const result = await this.packageService.softDelete(req.params.id, req.user);
    return this.noContent(res);
  }
}
