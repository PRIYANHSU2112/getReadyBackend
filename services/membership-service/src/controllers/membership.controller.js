import { ApiResponse, HttpStatus, AppError, ErrorCodes } from '@getready/errors';
import { membershipService as defaultMembershipService } from '../services/membership.service.js';

export class MembershipController {
  constructor(membershipService = defaultMembershipService) {
    this.membershipService = membershipService;
  }

  // --- Customer / User App Endpoints ---

  listPublicPlans = async (req, res) => {
    const plans = await this.membershipService.getActivePlans();
    return ApiResponse.success(res, plans, 'Active membership plans fetched successfully');
  };

  getMyStatus = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id || req.query.userId;
    if (!userId) {
      throw new AppError('Authentication required to view membership status', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }

    const status = await this.membershipService.getCustomerMembershipStatus(userId);
    return ApiResponse.success(res, status, 'Membership status retrieved');
  };

  subscribe = async (req, res) => {
    const userId = req.body.userId || req.headers['x-user-id'] || req.user?.id;
    if (!userId) {
      throw new AppError('Customer identity required to subscribe', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }

    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey || null;

    const result = await this.membershipService.subscribe({
      userId,
      planCode: req.body.planCode || 'GLOW_CLUB_MONTHLY',
      idempotencyKey,
    });

    return ApiResponse.created(res, result, 'Membership subscription initiated');
  };

  calculateBenefits = async (req, res) => {
    const userId = req.body.userId || req.headers['x-user-id'] || req.user?.id || null;

    const benefits = await this.membershipService.calculateCartBenefits({
      userId,
      items: req.body.items || [],
      grossSubtotal: req.body.grossSubtotal ?? req.body.subtotal ?? 0,
      optInRequested: Boolean(req.body.optInRequested || req.body.membershipOptIn),
      requestedPlanCode: req.body.requestedPlanCode || 'GLOW_CLUB_MONTHLY',
    });

    return ApiResponse.success(res, benefits, 'Membership benefits calculated');
  };

  cancel = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id || req.body.userId;
    if (!userId) {
      throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }

    const result = await this.membershipService.cancelSubscription({
      subscriptionId: req.body.subscriptionId,
      userId,
      reason: req.body.reason || 'Customer request',
    });

    return ApiResponse.success(res, result, 'Membership auto-renewal cancelled successfully');
  };

  addFamilyMember = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id || req.body.userId;
    if (!userId) {
      throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }

    const result = await this.membershipService.addFamilyMember({
      userId,
      familyUserId: req.body.familyUserId,
    });

    return ApiResponse.success(res, result, 'Family member added to shared membership');
  };

  claimEntitlement = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id || req.body.userId;
    if (!userId) {
      throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }

    const result = await this.membershipService.claimComplimentaryService({
      userId,
      entitlementId: req.body.entitlementId,
      bookingId: req.body.bookingId,
    });

    return ApiResponse.success(res, result, 'Complimentary entitlement claimed successfully');
  };

  // --- Payment Webhook Activation Endpoint ---

  webhookActivate = async (req, res) => {
    const { subscriptionId, paymentId, paymentOrderId } = req.body;
    if (!subscriptionId || !paymentId) {
      throw new AppError('subscriptionId and paymentId are required', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    const result = await this.membershipService.activateFromWebhook({
      subscriptionId,
      paymentId,
      paymentOrderId,
    });

    return ApiResponse.success(res, result, 'Membership activated successfully');
  };

  // --- Admin Dashboard Endpoints (100% Dynamic) ---

  listPlansAdmin = async (req, res) => {
    const plans = await this.membershipService.listPlansAdmin();
    return ApiResponse.success(res, plans, 'Plans retrieved');
  };

  createPlanAdmin = async (req, res) => {
    const adminUser = req.headers['x-user-email'] || req.user?.email || 'ADMIN';
    const plan = await this.membershipService.createPlan(req.body, adminUser);
    return ApiResponse.created(res, plan, 'Membership plan created successfully');
  };

  getPlanByIdAdmin = async (req, res) => {
    const plan = await this.membershipService.membershipRepo.findPlanById(req.params.id);
    if (!plan) {
      throw new AppError('Plan not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }
    return ApiResponse.success(res, plan, 'Plan details retrieved');
  };

  updatePlanAdmin = async (req, res) => {
    const adminUser = req.headers['x-user-email'] || req.user?.email || 'ADMIN';
    const plan = await this.membershipService.updatePlan(req.params.id, req.body, adminUser);
    return ApiResponse.success(res, plan, 'Membership plan updated successfully');
  };

  setPlanStatusAdmin = async (req, res) => {
    const adminUser = req.headers['x-user-email'] || req.user?.email || 'ADMIN';
    const plan = await this.membershipService.updatePlan(req.params.id, { status: req.body.status }, adminUser);
    return ApiResponse.success(res, plan, `Plan status updated to ${req.body.status}`);
  };

  searchMembersAdmin = async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.planCode) filter.planCode = req.query.planCode;
    if (req.query.userId) filter.userId = req.query.userId;

    const { items, total } = await this.membershipService.searchMembers(filter, { skip, limit });

    return ApiResponse.paginated(
      res,
      items,
      { page, limit, total, totalPages: Math.ceil(total / limit) },
      'Member directory fetched',
    );
  };

  getAnalyticsAdmin = async (req, res) => {
    const analytics = await this.membershipService.getAnalytics();
    return ApiResponse.success(res, analytics, 'Membership analytics retrieved');
  };
}

export const membershipController = new MembershipController();
export default MembershipController;
