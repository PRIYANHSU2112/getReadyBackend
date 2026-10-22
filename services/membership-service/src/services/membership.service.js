import {
  MembershipRepository,
  membershipRepository as defaultMembershipRepo,
} from '../repositories/membership.repository.js';
import { AppError, HttpStatus, ErrorCodes } from '@getready/errors';
import { logger } from '@getready/logger';

function roundToTwo(num) {
  return Math.round((Number(num) || 0) * 100) / 100;
}

export class MembershipService {
  constructor(membershipRepo = defaultMembershipRepo, eventPublisher = null) {
    this.membershipRepo = membershipRepo;
    this.eventPublisher = eventPublisher;
  }

  /**
   * Get all active public plans for User App with dynamic UI marketing
   */
  async getActivePlans() {
    return this.membershipRepo.findActivePlans();
  }

  /**
   * Get current customer membership status & entitlements
   */
  async getCustomerMembershipStatus(userId) {
    if (!userId) {
      return { isMember: false, status: 'NO_MEMBERSHIP' };
    }

    const sub = await this.membershipRepo.getActiveSubscriptionByUserId(userId);
    if (!sub) {
      return { isMember: false, status: 'NO_MEMBERSHIP' };
    }

    const now = new Date();
    const endDate = new Date(sub.endDate);
    const msRemaining = endDate.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

    const plan = sub.planSnapshot || {};
    const entitlements = this.membershipRepo.findEntitlementsBySubscription
      ? await this.membershipRepo.findEntitlementsBySubscription(sub.subscriptionId)
      : [];

    return {
      isMember: true,
      hasActiveMembership: true,
      subscriptionId: sub.subscriptionId,
      planCode: sub.planCode,
      tierName: plan.name || 'Glow Club Member',
      status: sub.status,
      startDate: sub.startDate,
      endDate: sub.endDate,
      daysRemaining,
      autoRenew: sub.autoRenew,
      discountPercentage: plan.discountPercentage || plan.discountValue || 15,
      maxDiscountPerBooking: plan.maxDiscountPerBooking || 500,
      loyaltyMultiplier: plan.loyaltyMultiplier || 2.0,
      familySharingAllowed: plan.familySharingAllowed || true,
      sharedWithCount: sub.sharedWithUserIds?.length || 0,
      complimentaryEntitlements: entitlements,
    };
  }

  /**
   * Initiate subscription purchase for Razorpay order
   */
  async subscribe({ userId, planCode = 'GLOW_CLUB_MONTHLY', idempotencyKey = null }) {
    if (!userId) {
      throw new AppError('User authentication required to subscribe', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }

    const plan = await this.membershipRepo.findPlanByCode(planCode);
    if (!plan || plan.status !== 'ACTIVE' || !plan.isActive) {
      throw new AppError(`Membership plan '${planCode}' is not available`, HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    const { subscription, isDuplicate } = await this.membershipRepo.initiateSubscription({
      userId,
      plan,
      idempotencyKey,
    });

    return {
      subscriptionId: subscription.subscriptionId,
      planCode: plan.planCode,
      name: plan.name,
      price: plan.price,
      currency: 'INR',
      status: subscription.status,
      isDuplicate,
    };
  }

  /**
   * Authoritative activation upon verified payment webhook
   */
  async activateFromWebhook({ subscriptionId, paymentId, paymentOrderId = null }) {
    const result = await this.membershipRepo.atomicActivateSubscription({
      subscriptionId,
      paymentId,
      paymentOrderId,
    });

    // Publish event for Wallet Service to credit 500 bonus join points
    if (this.eventPublisher && !result.isDuplicate) {
      try {
        await this.eventPublisher.publish('membership.activated', {
          subscriptionId: result.subscription.subscriptionId,
          userId: result.subscription.userId,
          planCode: result.subscription.planCode,
          bonusPoints: result.plan?.bonusPointsOnJoin || 500,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        logger.error({ err, subscriptionId }, 'Failed to publish membership.activated event');
      }
    }

    return result;
  }

  /**
   * Server-authoritative Cart & Pricing calculation
   */
  async calculateCartBenefits({
    userId,
    items = [],
    grossSubtotal = 0,
    optInRequested = false,
    requestedPlanCode = 'GLOW_CLUB_MONTHLY',
  }) {
    let isMember = false;
    let optInApplied = false;
    let membershipFee = 0;
    let membershipDiscount = 0;
    let appliedPlan = null;

    // 1. Check existing active membership
    const activeSub = await this.membershipRepo.getActiveSubscriptionByUserId(userId);
    if (activeSub) {
      isMember = true;
      appliedPlan = (await this.membershipRepo.findPlanByCode(activeSub.planCode)) || activeSub.planSnapshot;
    } else if (optInRequested) {
      // 2. User chose to join membership during checkout
      const plan = await this.membershipRepo.findPlanByCode(requestedPlanCode);
      if (plan && plan.status === 'ACTIVE') {
        optInApplied = true;
        isMember = true;
        membershipFee = roundToTwo(plan.price);
        appliedPlan = plan;
      }
    }

    // 3. Compute discount if eligible
    if (isMember && appliedPlan) {
      const discountPct = Number(appliedPlan.discountPercentage || appliedPlan.discountValue || 15);
      const cap = Number(appliedPlan.maxDiscountPerBooking || 500);
      const minBooking = Number(appliedPlan.minBookingSubtotal || 0);
      const excludedSet = new Set((appliedPlan.excludedServiceIds || []).map(String));
      const applicableCats = new Set((appliedPlan.applicableCategoryIds || []).map(String));

      if (grossSubtotal >= minBooking) {
        let eligibleSubtotal = 0;

        for (const item of items) {
          const serviceId = String(item.serviceId || item.id || '');
          const categoryId = String(item.categoryId || '');
          const price = Number(item.price || item.unitPrice || 0);
          const qty = Math.max(1, Number(item.quantity) || 1);

          const isExcluded = excludedSet.has(serviceId);
          const isCategoryMatch = applicableCats.size === 0 || applicableCats.has(categoryId);

          if (!isExcluded && isCategoryMatch) {
            eligibleSubtotal += price * qty;
          }
        }

        // If items were not individually passed, fall back to gross subtotal
        if (eligibleSubtotal === 0 && items.length === 0) {
          eligibleSubtotal = grossSubtotal;
        }

        let calculatedDiscount = (eligibleSubtotal * discountPct) / 100;
        if (cap > 0) {
          calculatedDiscount = Math.min(calculatedDiscount, cap);
        }

        membershipDiscount = roundToTwo(calculatedDiscount);
      }
    }

    return {
      isMember,
      optInApplied,
      membershipFee,
      membershipDiscount,
      discountPercentage: appliedPlan ? Number(appliedPlan.discountPercentage || appliedPlan.discountValue || 15) : 0,
      savingsToday: membershipDiscount,
      planCode: appliedPlan?.planCode || null,
      tierName: appliedPlan?.name || null,
      loyaltyMultiplier: appliedPlan?.loyaltyMultiplier || (isMember ? 2.0 : 1.0),
      welcomePerks: optInApplied ? { bonusPoints: appliedPlan?.bonusPointsOnJoin || 500 } : null,
    };
  }

  /**
   * Cancel auto-renewal
   */
  async cancelSubscription({ subscriptionId, userId, reason }) {
    return this.membershipRepo.atomicCancelSubscription({ subscriptionId, userId, reason });
  }

  /**
   * Claim complimentary monthly treatment for a booking
   */
  async claimComplimentaryService({ userId, entitlementId, bookingId }) {
    if (!userId || !entitlementId || !bookingId) {
      throw new AppError('userId, entitlementId, and bookingId are required', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }
    return this.membershipRepo.claimEntitlement({ userId, entitlementId, bookingId });
  }

  /**
   * Add family member profile to shared membership
   */
  async addFamilyMember({ userId, familyUserId }) {
    const sub = await this.membershipRepo.getActiveSubscriptionByUserId(userId);
    if (!sub) {
      throw new AppError('Active membership required to share benefits with family', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    const plan = sub.planSnapshot || {};
    if (!plan.familySharingAllowed) {
      throw new AppError('Family sharing is not supported on this membership plan', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    const currentMembers = sub.sharedWithUserIds || [];
    const maxMembers = plan.maxFamilyMembers || 4;

    if (currentMembers.length >= maxMembers) {
      throw new AppError(`Family sharing limit reached (${maxMembers} members max)`, HttpStatus.CONFLICT, ErrorCodes.CONFLICT);
    }

    if (currentMembers.includes(String(familyUserId))) {
      return { success: true, message: 'Family member already added', sub };
    }

    currentMembers.push(String(familyUserId));
    await this.membershipRepo.updateSubscription(sub._id, { sharedWithUserIds: currentMembers });

    return { success: true, sharedMembersCount: currentMembers.length };
  }

  /**
   * Admin: List all dynamic plans
   */
  async listPlansAdmin() {
    return this.membershipRepo.findAllPlansAdmin();
  }

  /**
   * Admin: Create dynamic plan
   */
  async createPlan(data, adminUser) {
    return this.membershipRepo.createPlan(data, adminUser);
  }

  /**
   * Admin: Update dynamic plan
   */
  async updatePlan(id, updates, adminUser) {
    return this.membershipRepo.updatePlan(id, updates, adminUser);
  }

  /**
   * Admin: Member Directory Search
   */
  async searchMembers(filter, pagination) {
    return this.membershipRepo.findSubscriptions(filter, pagination);
  }

  /**
   * Admin: Analytics
   */
  async getAnalytics() {
    return this.membershipRepo.getAnalytics();
  }
}

export const membershipService = new MembershipService();
export default MembershipService;
