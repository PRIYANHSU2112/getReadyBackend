import { BaseController } from '../../common/base/BaseController.js';

function actorFromReq(req) {
  return req.user
    ? { id: req.user.id || req.user.sub, role: req.user.role }
    : null;
}

export class ServiceController extends BaseController {
  /**
   * @param {import('./service.service.js').ServiceService} serviceService
   */
  constructor(serviceService) {
    super();
    this.serviceService = serviceService;
    this.bindMethods([
      'listPublic',
      'listPublicByCategory',
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
      'approveCreate',
      'rejectCreate',
      'listChangeRequests',
      'getChangeRequestById',
      'approveChangeRequest',
      'rejectChangeRequest',
    ]);
  }

  async listPublic(req, res) {
    const { items, meta } = await this.serviceService.listPublic(req.query);
    return this.ok(res, items, meta);
  }

  async listPublicByCategory(req, res) {
    const query = { ...req.query, categoryId: req.params.categoryId };
    const { items, meta } = await this.serviceService.listPublic(query);
    return this.ok(res, items, meta);
  }

  async getPublicBySlug(req, res) {
    const data = await this.serviceService.getPublicBySlug(req.params.slug);
    return this.ok(res, data);
  }

  async list(req, res) {
    const { items, meta } = await this.serviceService.list(
      req.query,
      actorFromReq(req),
    );
    return this.ok(res, items, meta);
  }

  async getById(req, res) {
    const data = await this.serviceService.getById(
      req.params.id,
      actorFromReq(req),
    );
    return this.ok(res, data);
  }

  async create(req, res) {
    const files = req.files || [];
    const thumbnail =
      files.find?.((f) => f.fieldname === 'thumbnail') ||
      req.file ||
      null;
    const gallery = Array.isArray(files)
      ? files.filter((f) => f.fieldname === 'files' || f.fieldname === 'file')
      : [];
    const data = await this.serviceService.create(
      req.body,
      actorFromReq(req),
      gallery.length ? gallery : files,
      thumbnail && thumbnail.fieldname === 'thumbnail' ? thumbnail : null,
    );
    return this.created(res, data);
  }

  async update(req, res) {
    const files = req.files || [];
    const gallery = Array.isArray(files)
      ? files.filter((f) => f.fieldname === 'files' || f.fieldname === 'file')
      : [];
    const thumbnail = Array.isArray(files)
      ? files.find((f) => f.fieldname === 'thumbnail')
      : null;
    const data = await this.serviceService.update(
      req.params.id,
      req.body,
      actorFromReq(req),
      gallery,
      thumbnail || null,
    );
    return this.ok(res, data);
  }

  async remove(req, res) {
    await this.serviceService.remove(req.params.id, actorFromReq(req));
    return this.noContent(res);
  }

  async restore(req, res) {
    const data = await this.serviceService.restore(
      req.params.id,
      actorFromReq(req),
    );
    return this.ok(res, data);
  }

  async setStatus(req, res) {
    const data = await this.serviceService.setStatus(
      req.params.id,
      req.body.isActive,
      actorFromReq(req),
    );
    return this.ok(res, data);
  }

  async reorder(req, res) {
    await this.serviceService.reorder(req.body.items, actorFromReq(req));
    return this.ok(res, { reordered: true });
  }

  async bulkSetStatus(req, res) {
    await this.serviceService.bulkSetStatus(
      req.body.ids,
      req.body.isActive,
      actorFromReq(req),
    );
    return this.ok(res, { updated: true });
  }

  async bulkDelete(req, res) {
    await this.serviceService.bulkDelete(req.body.ids, actorFromReq(req));
    return this.ok(res, { deleted: true });
  }

  async approveCreate(req, res) {
    const data = await this.serviceService.approveCreate(
      req.params.id,
      req.body,
      actorFromReq(req),
    );
    return this.ok(res, data);
  }

  async rejectCreate(req, res) {
    const data = await this.serviceService.rejectCreate(
      req.params.id,
      req.body,
      actorFromReq(req),
    );
    return this.ok(res, data);
  }

  async listChangeRequests(req, res) {
    const { items, meta } = await this.serviceService.listChangeRequests(
      req.query,
      actorFromReq(req),
    );
    return this.ok(res, items, meta);
  }

  async getChangeRequestById(req, res) {
    const data = await this.serviceService.getChangeRequestById(
      req.params.id,
      actorFromReq(req),
    );
    return this.ok(res, data);
  }

  async approveChangeRequest(req, res) {
    const data = await this.serviceService.approveChangeRequest(
      req.params.id,
      req.body,
      actorFromReq(req),
    );
    return this.ok(res, data);
  }

  async rejectChangeRequest(req, res) {
    const data = await this.serviceService.rejectChangeRequest(
      req.params.id,
      req.body,
      actorFromReq(req),
    );
    return this.ok(res, data);
  }
}
