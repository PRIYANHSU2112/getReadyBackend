import { BaseController } from '../../common/base/BaseController.js';

export class UserController extends BaseController {
  /**
   * @param {import('./user.service.js').UserService} userService
   */
  constructor(userService) {
    super();
    this.userService = userService;
    this.bindMethods(['create', 'list', 'getById', 'getMe', 'updateMe', 'update', 'remove']);
  }

  async create(req, res) {
    const user = await this.userService.createUser(req.body);
    return this.created(res, user);
  }

  async list(req, res) {
    const { items, meta } = await this.userService.listUsers(req.query);
    return this.ok(res, items, meta);
  }

  async getMe(req, res) {
    const user = await this.userService.getMe(req.user.id);
    return this.ok(res, user);
  }

  async updateMe(req, res) {
    const user = await this.userService.updateMe(req.user.id, req.body, req.file);
    return this.ok(res, user);
  }

  async getById(req, res) {
    const user = await this.userService.getUserById(req.params.id);
    return this.ok(res, user);
  }

  async update(req, res) {
    const user = await this.userService.updateUser(req.params.id, req.body, req.file);
    return this.ok(res, user);
  }

  async remove(req, res) {
    await this.userService.deleteUser(req.params.id);
    return this.noContent(res);
  }
}



