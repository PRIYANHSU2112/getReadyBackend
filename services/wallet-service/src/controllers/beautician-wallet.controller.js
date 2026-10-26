import { ApiResponse, HttpStatus } from '@getready/errors';

export class BeauticianWalletController {
  constructor(beauticianWalletService, payoutRepository) {
    this.service = beauticianWalletService;
    this.payoutRepo = payoutRepository;
  }

  getDashboard = async (req, res, next) => {
    try {
      const userId = req.user?.id || req.headers['x-user-id'];
      if (!userId) {
        return ApiResponse.error(res, 'User ID is required', HttpStatus.UNAUTHORIZED);
      }
      const data = await this.service.getDashboard(userId);
      return ApiResponse.success(res, data, 'Beautician wallet dashboard fetched', HttpStatus.OK);
    } catch (err) {
      next(err);
    }
  };

  getTransactions = async (req, res, next) => {
    try {
      const userId = req.user?.id || req.headers['x-user-id'];
      if (!userId) {
        return ApiResponse.error(res, 'User ID is required', HttpStatus.UNAUTHORIZED);
      }
      const { type = 'all', page = 1, limit = 20 } = req.query;
      const data = await this.service.getTransactions(userId, {
        type,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      });
      return ApiResponse.success(res, data, 'Transactions fetched', HttpStatus.OK);
    } catch (err) {
      next(err);
    }
  };

  getTransactionDetails = async (req, res, next) => {
    try {
      const userId = req.user?.id || req.headers['x-user-id'];
      if (!userId) {
        return ApiResponse.error(res, 'User ID is required', HttpStatus.UNAUTHORIZED);
      }
      const data = await this.service.getTransactionDetails(userId, req.params.id);
      return ApiResponse.success(res, data, 'Transaction details fetched', HttpStatus.OK);
    } catch (err) {
      next(err);
    }
  };

  requestPayout = async (req, res, next) => {
    try {
      const userId = req.user?.id || req.headers['x-user-id'];
      if (!userId) {
        return ApiResponse.error(res, 'User ID is required', HttpStatus.UNAUTHORIZED);
      }
      const result = await this.service.requestPayout(userId, req.body);
      return ApiResponse.success(res, result, 'Withdrawal request submitted successfully', HttpStatus.CREATED);
    } catch (err) {
      next(err);
    }
  };

  // Admin endpoints
  getAdminPayoutStats = async (req, res, next) => {
    try {
      const stats = await this.payoutRepo.getStats();
      return ApiResponse.success(res, stats, 'Payout stats fetched successfully', HttpStatus.OK);
    } catch (err) {
      next(err);
    }
  };

  listAdminPayouts = async (req, res, next) => {
    try {
      const { status, page = 1, limit = 25 } = req.query;
      const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
      const data = await this.payoutRepo.listAll({
        status,
        skip,
        limit: parseInt(limit, 10),
      });
      return ApiResponse.success(res, data, 'Payout requests fetched', HttpStatus.OK);
    } catch (err) {
      next(err);
    }
  };

  processAdminPayout = async (req, res, next) => {
    try {
      const adminUserId = req.user?.id || req.headers['x-user-id'] || 'ADMIN';
      const { action, transactionRef, reason } = req.body;
      const result = await this.service.adminProcessPayout(req.params.id, adminUserId, {
        action,
        transactionRef,
        reason,
      });
      return ApiResponse.success(res, result, `Payout ${action.toLowerCase()}ed successfully`, HttpStatus.OK);
    } catch (err) {
      next(err);
    }
  };

  // Dynamic Payout Config handlers
  getPayoutConfig = async (req, res, next) => {
    try {
      const config = await this.service.getPayoutConfig();
      return ApiResponse.success(res, config, 'Payout configuration fetched', HttpStatus.OK);
    } catch (err) {
      next(err);
    }
  };

  updatePayoutConfig = async (req, res, next) => {
    try {
      const adminUserId = req.user?.id || req.headers['x-user-id'] || 'ADMIN';
      const updated = await this.service.updatePayoutConfig(req.body, adminUserId);
      return ApiResponse.success(res, updated, 'Payout configuration updated successfully', HttpStatus.OK);
    } catch (err) {
      next(err);
    }
  };
}
