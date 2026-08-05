import { BaseController } from '../../common/base/BaseController.js';

export class CartController extends BaseController {
  /**
   * @param {import('./cart.service.js').CartService} cartService
   */
  constructor(cartService) {
    super();
    this.cartService = cartService;
    this.bindMethods([
      'getCart',
      'addItem',
      'updateItemQuantity',
      'removeItem',
      'updatePackageSelections',
      'updateRecipient',
      'bookForOthers',
      'updateInstructions',
      'updateBenefits',
      'clear',
    ]);
  }

  async getCart(req, res) {
    const cart = await this.cartService.getCart(req.user.id);
    return this.ok(res, cart);
  }

  async addItem(req, res) {
    const cart = await this.cartService.addItem(req.user.id, req.body);
    return this.ok(res, cart);
  }

  async updateItemQuantity(req, res) {
    const cart = await this.cartService.updateItemQuantity(
      req.user.id,
      req.params.lineId,
      req.body.quantity,
    );
    return this.ok(res, cart);
  }

  async removeItem(req, res) {
    const cart = await this.cartService.removeItem(req.user.id, req.params.lineId);
    return this.ok(res, cart);
  }

  async updatePackageSelections(req, res) {
    const cart = await this.cartService.updatePackageSelections(
      req.user.id,
      req.params.lineId,
      req.body.selectedServiceIds,
    );
    return this.ok(res, cart);
  }

  async updateRecipient(req, res) {
    const cart = await this.cartService.updateRecipient(
      req.user.id,
      req.params.lineId,
      req.body.forMemberId,
    );
    return this.ok(res, cart);
  }

  async bookForOthers(req, res) {
    const cart = await this.cartService.bookForOthers(req.user.id, req.body);
    return this.ok(res, cart);
  }

  async updateInstructions(req, res) {
    const cart = await this.cartService.updateInstructions(
      req.user.id,
      req.body.specialInstructions,
    );
    return this.ok(res, cart);
  }

  async updateBenefits(req, res) {
    const cart = await this.cartService.updateBenefits(req.user.id, req.body);
    return this.ok(res, cart);
  }

  async clear(req, res) {
    const cart = await this.cartService.clear(req.user.id);
    return this.ok(res, cart);
  }
}
