import { BaseController } from '../../common/base/BaseController.js';

export class BankDetailController extends BaseController {
  /**
   * @param {import('./bank-detail.service.js').BankDetailService} bankDetailService
   */
  constructor(bankDetailService) {
    super();
    this.bankDetailService = bankDetailService;
    this.bindMethods([
      'upsertBankDetail',
      'getMyBankDetail',
      'deleteBankDetail',
      'listBankDetails',
      'getBankDetailById',
      'reviewBankDetail',
    ]);
  }

  /** Beautician — create or update bank details */
  async upsertBankDetail(req, res) {
    const bankDetail = await this.bankDetailService.upsertBankDetail(
      req.user.id,
      req.body,
      req.file || null,
    );
    return this.ok(res, bankDetail);
  }

  /** Beautician — get own bank details */
  async getMyBankDetail(req, res) {
    const bankDetail = await this.bankDetailService.getMyBankDetail(req.user.id);
    return this.ok(res, bankDetail);
  }

  /** Beautician — delete own bank details */
  async deleteBankDetail(req, res) {
    await this.bankDetailService.deleteBankDetail(req.user.id);
    return this.noContent(res);
  }

  /** Admin — list all bank details */
  async listBankDetails(req, res) {
    const { items, meta } = await this.bankDetailService.listBankDetails(req.query);
    return this.ok(res, items, meta);
  }

  /** Admin — get bank detail by ID */
  async getBankDetailById(req, res) {
    const bankDetail = await this.bankDetailService.getBankDetailById(req.params.id);
    return this.ok(res, bankDetail);
  }

  /** Admin — verify/reject bank details */
  async reviewBankDetail(req, res) {
    const bankDetail = await this.bankDetailService.reviewBankDetail(
      req.params.id,
      req.body,
      req.user.id,
    );
    return this.ok(res, bankDetail);
  }
}
