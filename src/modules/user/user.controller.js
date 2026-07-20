import { BaseController } from '../../common/base/BaseController.js';

export class UserController extends BaseController {
  /**
   * @param {import('./user.service.js').UserService} userService
   */
  constructor(userService) {
    super();
    this.userService = userService;
    this.bindMethods(['create', 'login', 'list', 'getById', 'update', 'remove']);
  }

  async create(req, res) {
    const user = await this.userService.createUser(req.body);
    return this.created(res, user);
  }

  async login(req, res) {
    const result = await this.userService.login(req.body.email, req.body.password);
    return this.ok(res, result);
  }

  async list(req, res) {
    const { items, meta } = await this.userService.listUsers(req.query);
    return this.ok(res, items, meta);
  }

  async getById(req, res) {
    const user = await this.userService.getUserById(req.params.id);
    return this.ok(res, user);
  }

  async update(req, res) {
    const user = await this.userService.updateUser(req.params.id, req.body);
    return this.ok(res, user);
  }

  async remove(req, res) {
    await this.userService.deleteUser(req.params.id);
    return this.noContent(res);
  }
}
