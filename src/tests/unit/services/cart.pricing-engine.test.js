import { describe, it, expect } from '@jest/globals';
import { computeCartPricing } from '../../../modules/cart/cart.pricing-engine.js';
import { CartItemType } from '../../../common/constants/enums.js';
import { CART_VISIT_FEE_WAIVE_THRESHOLD } from '../../../common/constants/cart.js';

function serviceLine({ unitPrice, qty = 1, mrp = null, homeVisitFee = 0 }) {
  return {
    itemType: CartItemType.SERVICE,
    quantity: qty,
    snapshot: {
      unitPrice,
      mrp,
      homeVisitFee,
      extraCharge: 0,
    },
  };
}

describe('computeCartPricing', () => {
  it('computes subtotal, catalog savings, and grand total', () => {
    const pricing = computeCartPricing(
      {
        items: [serviceLine({ unitPrice: 900, mrp: 1000, qty: 1 })],
        benefits: {},
      },
      { now: new Date('2026-08-04T00:00:00.000Z') },
    );

    expect(pricing.subtotal).toBe(900);
    expect(pricing.savings).toBe(100);
    expect(pricing.grandTotal).toBe(900);
    expect(pricing.earnPoints).toBe(900);
  });

  it('waives visit fee when subtotal meets threshold', () => {
    const pricing = computeCartPricing({
      items: [
        serviceLine({
          unitPrice: CART_VISIT_FEE_WAIVE_THRESHOLD,
          homeVisitFee: 300,
        }),
      ],
      benefits: {},
    });

    expect(pricing.visitFee).toBe(0);
    expect(pricing.visitFeeWaived).toBe(true);
    expect(pricing.upsell).toBeNull();
  });

  it('builds upsell when visit fee applies below threshold', () => {
    const pricing = computeCartPricing({
      items: [serviceLine({ unitPrice: 700, homeVisitFee: 300 })],
      benefits: {},
    });

    expect(pricing.visitFee).toBe(300);
    expect(pricing.visitFeeWaived).toBe(false);
    expect(pricing.upsell.amountToWaiveVisitFee).toBe(CART_VISIT_FEE_WAIVE_THRESHOLD - 700);
    expect(pricing.grandTotal).toBe(1000);
  });

  it('applies points deduction capped by payable', () => {
    const pricing = computeCartPricing(
      {
        items: [serviceLine({ unitPrice: 500 })],
        benefits: { usePoints: true },
      },
      { pointsBalance: 1200 },
    );

    expect(pricing.pointsDeduction).toBe(500);
    expect(pricing.grandTotal).toBe(0);
  });

  it('prefers coupon path over points when both present in engine', () => {
    const pricing = computeCartPricing(
      {
        items: [serviceLine({ unitPrice: 999 })],
        benefits: { usePoints: true, couponCode: 'FIRST100' },
      },
      { pointsBalance: 500, couponDiscount: 100 },
    );

    expect(pricing.couponDiscount).toBe(100);
    expect(pricing.pointsDeduction).toBe(0);
    expect(pricing.grandTotal).toBe(899);
  });

  it('applies coupon when points/cashback flags are off', () => {
    const pricing = computeCartPricing(
      {
        items: [serviceLine({ unitPrice: 999 })],
        benefits: { couponCode: 'FIRST100' },
      },
      { couponDiscount: 100 },
    );

    expect(pricing.couponDiscount).toBe(100);
    expect(pricing.grandTotal).toBe(899);
    expect(pricing.savings).toBe(100);
  });
});
