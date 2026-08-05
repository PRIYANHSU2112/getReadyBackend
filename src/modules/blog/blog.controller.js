import { BaseController } from '../../common/base/BaseController.js';

export class BlogController extends BaseController {
  /**
   * @param {import('./blog.service.js').BlogService} blogService
   */
  constructor(blogService) {
    super();
    this.blogService = blogService;
    this.bindMethods([
      'home',
      'listPublic',
      'getPublic',
      'like',
      'listManage',
      'create',
      'getById',
      'update',
      'remove',
    ]);
  }

  async home(req, res) {
    const data = await this.blogService.getHome(req.query);
    return this.ok(res, data);
  }

  async listPublic(req, res) {
    const { items, meta } = await this.blogService.listPublic(req.query);
    return this.ok(res, items, meta);
  }

  async getPublic(req, res) {
    const blog = await this.blogService.getPublicDetail(req.params.id);
    return this.ok(res, blog);
  }

  async like(req, res) {
    const data = await this.blogService.like(req.params.id, req.user.id);
    return this.ok(res, data);
  }

  async listManage(req, res) {
    const { items, meta } = await this.blogService.listManage(req.query);
    return this.ok(res, items, meta);
  }

  async create(req, res) {
    const blog = await this.blogService.create(req.body, req.file || null, req.user?.id);
    return this.created(res, blog);
  }

  async getById(req, res) {
    const blog = await this.blogService.getByIdAdmin(req.params.id);
    return this.ok(res, blog);
  }

  async update(req, res) {
    const blog = await this.blogService.update(
      req.params.id,
      req.body,
      req.file || null,
      req.user?.id,
    );
    return this.ok(res, blog);
  }

  async remove(req, res) {
    const blog = await this.blogService.remove(req.params.id, req.user?.id);
    return this.ok(res, blog);
  }
}
