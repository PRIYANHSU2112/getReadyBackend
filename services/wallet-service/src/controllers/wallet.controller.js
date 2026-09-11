import { ApiResponse, HttpStatus } from '@getready/errors';

export class WalletController {
  constructor(walletService) {
    this.walletService = walletService;
  }

  getLoyaltyRules = async (req, res) => {
    const rules = await this.walletService.getLoyaltyRules();
    return ApiResponse.success(res, rules, 'Loyalty rules retrieved successfully');
  };

  updateLoyaltyRules = async (req, res) => {
    const adminUserId = req.user?.id || req.user?._id;
    const rules = await this.walletService.updateLoyaltyRules(req.body, adminUserId);
    return ApiResponse.success(res, rules, 'Loyalty rules updated successfully');
  };

  getWallet = async (req, res) => {
    const userId = req.user.id || req.user._id;
    const wallet = await this.walletService.getWallet(userId);
    return ApiResponse.success(res, wallet, 'Wallet retrieved successfully');
  };

  createTopupOrder = async (req, res) => {
    const userId = req.user.id || req.user._id;
    const { amount } = req.body;
    const order = await this.walletService.createTopupOrder(userId, amount);
    return ApiResponse.success(res, order, 'Topup order created successfully', HttpStatus.CREATED);
  };

  verifyTopupPayment = async (req, res) => {
    const userId = req.user.id || req.user._id;
    const wallet = await this.walletService.verifyTopupPayment(userId, req.body);
    return ApiResponse.success(res, wallet, 'Payment verified and wallet credited');
  };

  listTransactions = async (req, res) => {
    const userId = req.user.id || req.user._id;
    const { limit = 20, page = 1, type } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const result = await this.walletService.listTransactions(userId, {
      limit: Number(limit),
      skip,
      type,
    });
    return ApiResponse.success(res, result.transactions, 'Transactions retrieved successfully', HttpStatus.OK, {
      total: result.total,
      page: Number(page),
      limit: Number(limit),
    });
  };

  addPoints = async (req, res) => {
    const userId = req.user.id || req.user._id;
    const { points, reason, referenceId } = req.body;
    const wallet = await this.walletService.addPoints(userId, points, reason, referenceId);
    return ApiResponse.success(res, wallet, 'Points added successfully');
  };

  deductPoints = async (req, res) => {
    const userId = req.user.id || req.user._id;
    const { points, reason, referenceId } = req.body;
    const wallet = await this.walletService.deductPoints(userId, points, reason, referenceId);
    return ApiResponse.success(res, wallet, 'Points deducted successfully');
  };

  handleRazorpayWebhook = async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    const result = await this.walletService.handleRazorpayWebhook(req.body, signature);
    return res.status(HttpStatus.OK).json(result);
  };

  listWallets = async (req, res) => {
    const result = await this.walletService.listWallets(req.query);
    return ApiResponse.paginated(
      res,
      result.items,
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        hasNext: result.page < result.totalPages,
        hasPrevious: result.page > 1,
      },
      'Wallets fetched successfully',
    );
  };

  getKpis = async (req, res) => {
    const kpis = await this.walletService.getKpis();
    return ApiResponse.success(res, kpis, 'Wallet KPIs retrieved successfully');
  };

  createWallet = async (req, res) => {
    const wallet = await this.walletService.createWalletManual(req.body);
    return ApiResponse.created(res, wallet, 'Wallet created successfully');
  };

  updateWallet = async (req, res) => {
    const { id } = req.params;
    const wallet = await this.walletService.updateWallet(id, req.body);
    return ApiResponse.success(res, wallet, 'Wallet updated successfully');
  };

  deleteWallet = async (req, res) => {
    const { id } = req.params;
    const result = await this.walletService.deleteWallet(id);
    return ApiResponse.success(res, result, 'Wallet deactivated successfully');
  };
}
