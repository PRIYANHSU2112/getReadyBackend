import { ApiResponse, HttpStatus, AppError, ErrorCodes } from '@getready/errors';
import { promotionService as defaultPromotionService } from '../services/promotion.service.js';

export class PromotionController {
  constructor(promotionService = defaultPromotionService) {
    this.promoService = promotionService;
  }

  // --- Client / User Endpoints ---

  getEligible = async (req, res) => {
    const scope = req.query.scope;
    const userId = req.headers['x-user-id'] || req.user?.id || req.query.userId || null;
    const userPhone = req.headers['x-user-phone'] || req.user?.phone || req.query.userPhone || null;

    const offers = await this.promoService.getEligibleOffers({
      scope,
      userId,
      userPhone,
    });

    return ApiResponse.success(res, offers, 'Eligible offers retrieved successfully');
  };

  quote = async (req, res) => {
    const userId = req.body.userId || req.headers['x-user-id'] || req.user?.id || null;
    const userPhone = req.body.userPhone || req.headers['x-user-phone'] || req.user?.phone || null;

    const quote = await this.promoService.quoteOffer({
      code: req.body.code,
      scope: req.body.scope,
      userId,
      userPhone,
      items: req.body.items || [],
      cartAmount: req.body.cartAmount ?? req.body.amount ?? 0,
      coinPackId: req.body.coinPackId || null,
    });

    return ApiResponse.success(res, quote, 'Offer quote calculated successfully');
  };

  createReservation = async (req, res) => {
    const userId = req.body.userId || req.headers['x-user-id'] || req.user?.id;
    if (!userId) {
      throw new AppError('Customer identity (userId) is required to apply an offer', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }

    const userPhone = req.body.userPhone || req.headers['x-user-phone'] || req.user?.phone || null;
    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey || null;

    const reservation = await this.promoService.createReservation({
      code: req.body.code,
      scope: req.body.scope,
      userId,
      userPhone,
      orderId: req.body.orderId || null,
      cartId: req.body.cartId || null,
      items: req.body.items || [],
      cartAmount: req.body.cartAmount ?? req.body.amount ?? 0,
      coinPackId: req.body.coinPackId || null,
      idempotencyKey,
      metadata: req.body.metadata || {},
    });

    return ApiResponse.created(res, reservation, 'Offer capacity reserved successfully');
  };

  confirmReservation = async (req, res) => {
    const reservationId = req.params.id;
    const orderId = req.body.orderId || req.params.orderId;

    const result = await this.promoService.confirmReservation({
      reservationId,
      orderId,
    });

    return ApiResponse.success(res, result, 'Offer reservation confirmed successfully');
  };

  releaseReservation = async (req, res) => {
    const reservationId = req.params.id;
    const reason = req.body.reason || 'Checkout cancelled';

    const result = await this.promoService.releaseReservation({
      reservationId,
      reason,
    });

    return ApiResponse.success(res, result, 'Offer reservation released successfully');
  };

  getUserHistory = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id || req.query.userId;
    if (!userId) {
      throw new AppError('Authentication required to view offer history', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const history = await this.promoService.getUserHistory(userId, { skip, limit });

    return ApiResponse.paginated(res, history, { page, limit, total: history.length }, 'Offer history retrieved');
  };

  // --- Admin Endpoints ---

  listAdmin = async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = { deletedAt: null };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.scope) filter.scope = req.query.scope;
    if (req.query.search) {
      filter.$or = [
        { code: new RegExp(req.query.search, 'i') },
        { name: new RegExp(req.query.search, 'i') },
      ];
    }

    const { items, total } = await this.promoService.listPromotions(filter, { skip, limit });

    return ApiResponse.paginated(
      res,
      items,
      { page, limit, total, totalPages: Math.ceil(total / limit) },
      'Promotions fetched successfully',
    );
  };

  getByIdAdmin = async (req, res) => {
    const promo = await this.promoService.promoRepo.findById(req.params.id);
    if (!promo) {
      throw new AppError('Promotion not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }
    return ApiResponse.success(res, promo, 'Promotion details fetched');
  };

  createAdmin = async (req, res) => {
    const adminUser = req.headers['x-user-email'] || req.user?.email || 'ADMIN';
    const promo = await this.promoService.createPromotion(req.body, adminUser);
    return ApiResponse.created(res, promo, 'Promotion campaign created successfully');
  };

  updateAdmin = async (req, res) => {
    const adminUser = req.headers['x-user-email'] || req.user?.email || 'ADMIN';
    const updated = await this.promoService.updatePromotion(req.params.id, req.body, adminUser);
    return ApiResponse.success(res, updated, 'Promotion campaign updated successfully');
  };

  setStatusAdmin = async (req, res) => {
    const adminUser = req.headers['x-user-email'] || req.user?.email || 'ADMIN';
    const updated = await this.promoService.updatePromotion(
      req.params.id,
      { status: req.body.status },
      adminUser,
    );
    return ApiResponse.success(res, updated, `Promotion status updated to ${req.body.status}`);
  };

  getAnalyticsAdmin = async (req, res) => {
    const report = await this.promoService.getPromotionAnalytics(req.params.id);
    return ApiResponse.success(res, report, 'Promotion analytics report fetched successfully');
  };

  getAdminStats = async (_req, res) => {
    const stats = await this.promoService.getAdminStats();
    return ApiResponse.success(res, stats, 'Promotion stats retrieved successfully');
  };
}

export const promotionController = new PromotionController();
export default PromotionController;
