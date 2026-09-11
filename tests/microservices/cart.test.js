import { describe, it, expect } from '@jest/globals';
import { computeCartPricing } from '../../services/cart-service/src/pricing/cart.pricing-engine.js';
import { PricingEngine } from '../../services/cart-service/src/pricing/pricing.engine.js';
import { toCartDto } from '../../services/cart-service/src/services/cart.mapper.js';

describe('Cart Service & Pricing Engine Test Suite', () => {
  it('should calculate basic bill without discounts', () => {
    const bill = PricingEngine.calculateBill({
      items: [
        { quantity: 2, snapshot: { unitPrice: 500, mrp: 700, extraCharge: 0, homeVisitFee: 49 } },
      ],
      hygieneKit: { count: 1, unitPrice: 49 },
      config: { visitFeeThreshold: 999 },
    });

    expect(bill.itemsSubtotal).toBe(1000);
    expect(bill.hygieneKitTotal).toBe(49);
    expect(bill.subtotal).toBe(1049);
    expect(bill.isVisitFeeWaived).toBe(true);
    expect(bill.grandTotal).toBe(1049);
  });

  it('should apply percentage coupon discount accurately', () => {
    const bill = PricingEngine.calculateBill({
      items: [
        { quantity: 1, snapshot: { unitPrice: 1000, mrp: 1200 } },
      ],
      hygieneKit: { count: 1, unitPrice: 49 },
      coupon: {
        coupon: {
          code: 'SAVE20',
          discountType: 'PERCENTAGE',
          discountValue: 20,
          maxDiscountAmount: 300,
          minOrderValue: 500,
        },
      },
    });

    expect(bill.couponDiscount).toBe(200);
    expect(bill.grandTotal).toBe(849);
  });

  it('should apply loyalty points deduction up to maximum percentage limit', () => {
    const bill = PricingEngine.calculateBill({
      items: [
        { quantity: 1, snapshot: { unitPrice: 1000, mrp: 1000 } },
      ],
      hygieneKit: { count: 1, unitPrice: 49 },
      points: {
        usePoints: true,
        pointsBalance: 1000, // 1000 pts * 0.10 = 100 INR
        pointsRedeemRatio: 0.10,
        minPointsToRedeem: 100,
        maxPointsRedeemPercentage: 50,
      },
    });

    expect(bill.pointsValueDeducted).toBe(100);
    expect(bill.pointsDeducted).toBe(1000);
    expect(bill.grandTotal).toBe(949);
  });

  it('should map cart model to DTO cleanly', () => {
    const mockCart = {
      _id: '65fc8e129182a1048b111001',
      userId: '65fc8e129182a1048b111002',
      items: [
        {
          _id: '65fc8e129182a1048b111003',
          itemType: 'SERVICE',
          refId: '65fc8e129182a1048b111004',
          quantity: 1,
          snapshot: { name: 'Hair Spa', unitPrice: 799 },
          selectedServices: [],
        },
      ],
      hygieneKit: { count: 1 },
      benefits: { usePoints: false },
      pricing: { grandTotal: 848, subtotal: 848 },
    };

    const dto = toCartDto(mockCart);
    expect(dto.id).toBe('65fc8e129182a1048b111001');
    expect(dto.itemCount).toBe(1);
    expect(dto.items).toHaveLength(1);
    expect(dto.items[0].snapshot.name).toBe('Hair Spa');
  });
});
