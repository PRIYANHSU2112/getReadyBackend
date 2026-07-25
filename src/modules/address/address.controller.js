import { BaseController } from '../../common/base/BaseController.js';

export class AddressController extends BaseController {
  /**
   * @param {import('./address.service.js').AddressService} addressService
   */
  constructor(addressService) {
    super();
    this.addressService = addressService;
    this.bindMethods(['list', 'getById', 'create', 'update', 'remove', 'setDefault']);
  }

  async list(req, res) {
    const { items, meta } = await this.addressService.listMine(req.user.id, req.query);
    return this.ok(res, items, meta);
  }

  async getById(req, res) {
    const address = await this.addressService.getMineById(req.user.id, req.params.id);
    return this.ok(res, address);
  }

  async create(req, res) {
    const address = await this.addressService.createMine(req.user.id, req.body);
    return this.created(res, address);
  }

  async update(req, res) {
    const address = await this.addressService.updateMine(
      req.user.id,
      req.params.id,
      req.body,
    );
    return this.ok(res, address);
  }

  async remove(req, res) {
    await this.addressService.deleteMine(req.user.id, req.params.id);
    return this.noContent(res);
  }

  async setDefault(req, res) {
    const address = await this.addressService.setDefaultMine(req.user.id, req.params.id);
    return this.ok(res, address);
  }
}
