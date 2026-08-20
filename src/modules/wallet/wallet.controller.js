import { BaseController } from '../../common/base/BaseController.js';

export class WalletController extends BaseController {
  /**
   * @param {import('./wallet.service.js').WalletService} walletService
   */
  constructor(walletService) {
    super();
    this.walletService = walletService;
    this.bindMethods([
      'getWallet',
      'createTopupOrder',
      'verifyTopupPayment',
      'handleRazorpayWebhook',
      'addPoints',
      'deductPoints',
      'listTransactions',
      'getLoyaltyRules',
      'updateLoyaltyRules',
    ]);
  }

  async getLoyaltyRules(req, res) {
    const rules = await this.walletService.getLoyaltyRules();
    return this.ok(res, rules);
  }

  async updateLoyaltyRules(req, res) {
    const adminUserId = req.user?.id || null;
    const rules = await this.walletService.updateLoyaltyRules(req.body, adminUserId);
    return this.ok(res, rules);
  }


  async getWallet(req, res) {
    const userId = req.user.id;
    const wallet = await this.walletService.getWallet(userId);
    return this.ok(res, wallet);
  }

  async createTopupOrder(req, res) {
    const userId = req.user.id;
    const result = await this.walletService.createTopupOrder(userId, req.body);
    return this.created(res, result);
  }

  async verifyTopupPayment(req, res) {
    const userId = req.user.id;
    const result = await this.walletService.verifyTopupPayment(userId, req.body);
    return this.ok(res, result);
  }

  async handleRazorpayWebhook(req, res) {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const result = await this.walletService.handleRazorpayWebhook(
      rawBody,
      signature,
      req.body,
    );
    return this.ok(res, result);
  }

  async addPoints(req, res) {
    const userId = req.user.id;
    const result = await this.walletService.addPoints(userId, req.body);
    return this.ok(res, result);
  }

  async deductPoints(req, res) {
    const userId = req.user.id;
    const result = await this.walletService.deductPoints(userId, req.body);
    return this.ok(res, result);
  }

  async listTransactions(req, res) {
    const userId = req.user.id;
    const result = await this.walletService.listTransactions(userId, req.query);
    return this.ok(res, result.items, result.meta);
  }
}
