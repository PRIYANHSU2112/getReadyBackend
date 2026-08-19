import {
  CART_VISIT_FEE_WAIVE_THRESHOLD,
  CART_POINTS_RATE,
  CART_CURRENCY,
} from '../../common/constants/cart.js';
import { CartItemType } from '../../common/constants/enums.js';

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function lineUnitTotal(item) {
  const unit = Number(item?.snapshot?.unitPrice) || 0;
  const extra = Number(item?.snapshot?.extraCharge) || 0;
  const qty = Number(item?.quantity) || 0;
  return (unit + extra) * qty;
}

function lineMrpTotal(item) {
  const mrp = item?.snapshot?.mrp;
  const unit = Number(item?.snapshot?.unitPrice) || 0;
  const base = mrp != null && mrp > unit ? Number(mrp) : unit;
  const extra = Number(item?.snapshot?.extraCharge) || 0;
  const qty = Number(item?.quantity) || 0;
  return (base + extra) * qty;
}

function lineVisitFee(item) {
  if (item?.itemType !== CartItemType.SERVICE) return 0;
  const fee = Number(item?.snapshot?.homeVisitFee) || 0;
  const qty = Number(item?.quantity) || 0;
  return fee * qty;
}

/**
 * Pure cart pricing. No I/O — pass resolved benefit amounts in.
 *
 * @param {object} cart
 * @param {{
 *   couponDiscount?: number,
 *   pointsBalance?: number,
 *   cashbackBalance?: number,
 *   visitFeeWaiveThreshold?: number,
 *   pointsRate?: number,
 *   currency?: string,
 *   now?: Date,
 * }} [options]
 */
export function computeCartPricing(cart, options = {}) {
  const items = Array.isArray(cart?.items) ? cart.items : [];
  const benefits = cart?.benefits || {};

  const visitFeeWaiveThreshold =
    options.visitFeeWaiveThreshold ?? CART_VISIT_FEE_WAIVE_THRESHOLD;
  const pointsRate = options.pointsRate ?? CART_POINTS_RATE;
  const currency = options.currency ?? CART_CURRENCY;
  const now = options.now ?? new Date();

  const subtotal = roundMoney(items.reduce((sum, item) => sum + lineUnitTotal(item), 0));
  const catalogMrpTotal = roundMoney(items.reduce((sum, item) => sum + lineMrpTotal(item), 0));
  const catalogSavings = roundMoney(Math.max(0, catalogMrpTotal - subtotal));

  let visitFee = roundMoney(items.reduce((sum, item) => sum + lineVisitFee(item), 0));
  let visitFeeWaived = false;
  let upsell = null;

  if (visitFee > 0 && subtotal >= visitFeeWaiveThreshold) {
    visitFee = 0;
    visitFeeWaived = true;
  } else if (visitFee > 0 && subtotal < visitFeeWaiveThreshold) {
    const amountToWaiveVisitFee = roundMoney(visitFeeWaiveThreshold - subtotal);
    upsell = {
      amountToWaiveVisitFee,
      message: `Add ₹${amountToWaiveVisitFee} more to waive the ₹${visitFee} service charge`,
    };
  }

  const payableBeforeBenefits = roundMoney(subtotal + visitFee);

  let couponDiscount = 0;
  let pointsDeduction = 0;
  let cashbackDeduction = 0;

  const hasCoupon = Boolean(benefits.couponCode);
  const usesPoints = Boolean(benefits.usePoints || benefits.useCredits);
  const usesCashback = Boolean(benefits.useCashback);

  // Exactly 1 benefit per order. Evaluated exclusively in priority order: Coupon > Points > Cashback.
  if (hasCoupon) {
    couponDiscount = roundMoney(
      Math.min(Number(options.couponDiscount) || 0, payableBeforeBenefits),
    );
  } else if (usesPoints) {
    pointsDeduction = roundMoney(
      Math.min(Number(options.pointsBalance ?? options.creditsBalance) || 0, payableBeforeBenefits),
    );
  } else if (usesCashback) {
    cashbackDeduction = roundMoney(
      Math.min(Number(options.cashbackBalance) || 0, payableBeforeBenefits),
    );
  }

  const benefitSavings = roundMoney(
    couponDiscount + pointsDeduction + cashbackDeduction,
  );
  const grandTotal = roundMoney(Math.max(0, payableBeforeBenefits - benefitSavings));
  const savings = roundMoney(catalogSavings + benefitSavings);
  const earnPoints = Math.max(0, Math.floor(grandTotal * pointsRate));

  return {
    subtotal,
    visitFee,
    visitFeeWaived,
    couponDiscount,
    pointsDeduction,
    cashbackDeduction,
    grandTotal,
    savings,
    earnPoints,
    upsell,
    currency,
    computedAt: now,
  };
}

export const CartPricingEngine = {
  compute: computeCartPricing,
};
