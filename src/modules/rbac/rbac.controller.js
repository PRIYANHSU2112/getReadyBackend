import { BaseController } from '../../common/base/BaseController.js';

export class RbacController extends BaseController {
  /**
   * @param {import('./rbac.service.js').RbacService} rbacService
   */
  constructor(rbacService) {
    super();
    this.rbacService = rbacService;
    this.bindMethods([
      'listRoles',
      'getRoleById',
      'createRole',
      'updateRole',
      'deleteRole',
      'setRolePermissions',
      'listPermissions',
      'syncPermissions',
    ]);
  }

  async listRoles(req, res) {
    const { items, meta } = await this.rbacService.listRoles(req.query);
    return this.ok(res, items, meta);
  }

  async getRoleById(req, res) {
    const role = await this.rbacService.getRoleById(req.params.id);
    return this.ok(res, role);
  }

  async createRole(req, res) {
    const role = await this.rbacService.createRole(req.body);
    return this.created(res, role);
  }

  async updateRole(req, res) {
    const role = await this.rbacService.updateRole(req.params.id, req.body);
    return this.ok(res, role);
  }

  async deleteRole(req, res) {
    await this.rbacService.deleteRole(req.params.id);
    return this.noContent(res);
  }

  async setRolePermissions(req, res) {
    const role = await this.rbacService.setRolePermissions(
      req.params.id,
      req.body.permissions,
    );
    return this.ok(res, role);
  }

  async listPermissions(req, res) {
    const { items, meta } = await this.rbacService.listPermissions(req.query);
    return this.ok(res, items, meta);
  }

  async syncPermissions(req, res) {
    const result = await this.rbacService.syncPermissionsFromRegistry();
    return this.ok(res, result);
  }
}
