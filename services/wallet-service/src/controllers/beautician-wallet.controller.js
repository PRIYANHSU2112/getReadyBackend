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
      return ApiResponse.success(res, data, HttpStatus.OK, 'Beautician wallet dashboard fetched');
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
      return ApiResponse.success(res, data, HttpStatus.OK, 'Transactions fetched');
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
      return ApiResponse.success(res, data, HttpStatus.OK, 'Transaction details fetched');
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
      return ApiResponse.success(res, result, HttpStatus.CREATED, 'Withdrawal request submitted successfully');
    } catch (err) {
      next(err);
    }
  };

  // Admin endpoints
  listAdminPayouts = async (req, res, next) => {
    try {
      const { status, page = 1, limit = 25 } = req.query;
      const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
      const data = await this.payoutRepo.listAll({
        status,
        skip,
        limit: parseInt(limit, 10),
      });
      return ApiResponse.success(res, data, HttpStatus.OK, 'Payout requests fetched');
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
      return ApiResponse.success(res, result, HttpStatus.OK, `Payout ${action.toLowerCase()}ed successfully`);
    } catch (err) {
      next(err);
    }
  };

  // Dynamic Payout Config handlers
  getPayoutConfig = async (req, res, next) => {
    try {
      const config = await this.service.getPayoutConfig();
      return ApiResponse.success(res, config, HttpStatus.OK, 'Payout configuration fetched');
    } catch (err) {
      next(err);
    }
  };

  updatePayoutConfig = async (req, res, next) => {
    try {
      const adminUserId = req.user?.id || req.headers['x-user-id'] || 'ADMIN';
      const updated = await this.service.updatePayoutConfig(req.body, adminUserId);
      return ApiResponse.success(res, updated, HttpStatus.OK, 'Payout configuration updated successfully');
    } catch (err) {
      next(err);
    }
  };
}

