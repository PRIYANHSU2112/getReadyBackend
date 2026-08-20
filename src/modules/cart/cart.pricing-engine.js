import { PricingEngine } from '../../common/pricing/pricing.engine.js';
import {
  CART_VISIT_FEE_WAIVE_THRESHOLD,
  CART_POINTS_RATE,
  CART_CURRENCY,
} from '../../common/constants/cart.js';

/**
 * Pure cart pricing delegated to centralized backend PricingEngine.
 * Single backend source of truth.
 *
 * @param {object} cart
 * @param {object} [options]
 */
export function computeCartPricing(cart, options = {}) {
  const items = Array.isArray(cart?.items) ? cart.items : [];
  const benefits = cart?.benefits || {};

  const kitCount = items.length > 0
    ? (Number(cart?.hygieneKit?.count ?? cart?.hygieneKit?.quantity) || 1)
    : (Number(cart?.hygieneKit?.count ?? cart?.hygieneKit?.quantity) || 0);

  const bill = PricingEngine.calculateBill({
    items,
    hygieneKit: {
      count: kitCount,
      unitPrice: options.hygieneKitUnitPrice ?? 49,
    },
    membership: {
      isMember: options.isMember || false,
      optInMembership: Boolean(benefits.membershipOptIn),
      membershipPlan: options.membershipPlan || null,
    },
    coupon: {
      couponDiscount: Number(options.couponDiscount) || 0,
      coupon: options.coupon || null,
    },
    points: {
      usePoints: Boolean(benefits.usePoints || benefits.useCredits),
      pointsBalance: Number(options.pointsBalance ?? options.creditsBalance) || 0,
      pointsRedeemRatio: options.pointsRedeemRatio,
      pointsEarnRatio: options.pointsEarnRatio ?? options.pointsRate ?? CART_POINTS_RATE,
      minPointsToRedeem: options.minPointsToRedeem ?? 0,
      maxPointsRedeemPercentage: options.maxPointsRedeemPercentage ?? 100,
    },
    cashback: {
      useCashback: Boolean(benefits.useCashback),
      cashbackBalance: Number(options.cashbackBalance) || 0,
    },
    config: {
      visitFeeThreshold: options.visitFeeWaiveThreshold ?? CART_VISIT_FEE_WAIVE_THRESHOLD,
      currency: options.currency ?? CART_CURRENCY,
    },
  });

  const visitFeeWaiveThreshold = options.visitFeeWaiveThreshold ?? CART_VISIT_FEE_WAIVE_THRESHOLD;
  let upsell = null;
  if (bill.visitFee > 0 && bill.subtotal < visitFeeWaiveThreshold) {
    const amountToWaive = Math.round((visitFeeWaiveThreshold - bill.subtotal) * 100) / 100;
    upsell = {
      amountToWaiveVisitFee: amountToWaive,
      message: `Add ₹${amountToWaive} more to waive the ₹${bill.visitFee} service charge`,
    };
  }

  return {
    itemsSubtotal: bill.itemsSubtotal,
    hygieneKitTotal: bill.hygieneKitTotal,
    subtotal: bill.subtotal,
    visitFee: bill.visitFee,
    visitFeeWaived: bill.isVisitFeeWaived,
    couponDiscount: bill.couponDiscount,
    pointsDeduction: bill.pointsValueDeducted,
    cashbackDeduction: bill.cashbackDeducted,
    grandTotal: bill.grandTotal,
    savings: bill.totalSavings,
    earnPoints: bill.earnPoints,
    upsell,
    currency: bill.currency,
    computedAt: options.now ?? bill.computedAt,
  };
}

export const CartPricingEngine = {
  compute: computeCartPricing,
};

