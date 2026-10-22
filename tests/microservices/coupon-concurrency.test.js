import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CouponService } from '../../services/catalog-service/src/services/coupon.service.js';
import { AppError } from '@getready/errors';

describe('Coupon Usage, Redemption & Concurrency Test Suite', () => {
  let mockCouponRepo;
  let mockEventPublisher;
  let couponService;

  beforeEach(() => {
    mockCouponRepo = {
      findByCode: jest.fn(),
      countUserRedemptions: jest.fn(),
      atomicRedeem: jest.fn(),
      atomicRollback: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      updateById: jest.fn(),
      deleteById: jest.fn(),
    };

    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(true),
    };

    couponService = new CouponService(mockCouponRepo, mockEventPublisher);
  });

  describe('Coupon Validation & Precise Discount Calculations', () => {
    it('should accurately calculate percentage discount with maximum cap', async () => {
      mockCouponRepo.findByCode.mockResolvedValue({
        _id: 'coupon_percent_1',
        code: 'SAVE20',
        discountType: 'PERCENTAGE',
        discountValue: 20,
        minOrderValue: 500,
        maxDiscountAmount: 150,
        usageLimit: 100,
        usedCount: 10,
        perUserLimit: 2,
        status: 'ACTIVE',
        isActive: true,
        validFrom: new Date(Date.now() - 10000),
        validTo: new Date(Date.now() + 100000),
        deletedAt: null,
      });
      mockCouponRepo.countUserRedemptions.mockResolvedValue(0);

      // Order 1: 1000 order => 20% = 200, but capped at 150
      const result = await couponService.validateCoupon('SAVE20', { amount: 1000, userId: 'user_1' });
      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(150);
      expect(result.payableAmount).toBe(850);
    });

    it('should accurately calculate flat discount capped at order subtotal', async () => {
      mockCouponRepo.findByCode.mockResolvedValue({
        _id: 'coupon_flat_1',
        code: 'FLAT300',
        discountType: 'FLAT',
        discountValue: 300,
        minOrderValue: 250,
        maxDiscountAmount: null,
        usageLimit: 50,
        usedCount: 2,
        perUserLimit: 1,
        status: 'ACTIVE',
        isActive: true,
        validFrom: new Date(Date.now() - 10000),
        validTo: new Date(Date.now() + 100000),
        deletedAt: null,
      });
      mockCouponRepo.countUserRedemptions.mockResolvedValue(0);

      // Order of 280 with 300 flat discount should cap discount to 280, payable 0
      const result = await couponService.validateCoupon('FLAT300', { amount: 280, userId: 'user_2' });
      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(280);
      expect(result.payableAmount).toBe(0);
    });

    it('should reject validation if order amount is below minOrderValue', async () => {
      mockCouponRepo.findByCode.mockResolvedValue({
        _id: 'coupon_min_1',
        code: 'BIGSAVER',
        discountType: 'FLAT',
        discountValue: 100,
        minOrderValue: 1000,
        usageLimit: 50,
        usedCount: 0,
        status: 'ACTIVE',
        isActive: true,
        validFrom: new Date(Date.now() - 10000),
        validTo: new Date(Date.now() + 100000),
        deletedAt: null,
      });

      await expect(
        couponService.validateCoupon('BIGSAVER', { amount: 500, userId: 'user_1' })
      ).rejects.toThrow('Minimum order value of ₹1000 required');
    });

    it('should reject expired coupons', async () => {
      mockCouponRepo.findByCode.mockResolvedValue({
        _id: 'coupon_exp_1',
        code: 'EXPIRED10',
        discountType: 'FLAT',
        discountValue: 50,
        minOrderValue: 0,
        status: 'ACTIVE',
        isActive: true,
        validFrom: new Date(Date.now() - 200000),
        validTo: new Date(Date.now() - 10000), // Expired in past
        deletedAt: null,
      });

      await expect(
        couponService.validateCoupon('EXPIRED10', { amount: 500, userId: 'user_1' })
      ).rejects.toThrow('This coupon has expired');
    });

    it('should reject when global usage limit has already been reached', async () => {
      mockCouponRepo.findByCode.mockResolvedValue({
        _id: 'coupon_soldout_1',
        code: 'LIMITED5',
        discountType: 'FLAT',
        discountValue: 100,
        usageLimit: 5,
        usedCount: 5, // Fully consumed
        status: 'ACTIVE',
        isActive: true,
        validFrom: new Date(Date.now() - 10000),
        validTo: new Date(Date.now() + 100000),
        deletedAt: null,
      });

      await expect(
        couponService.validateCoupon('LIMITED5', { amount: 500, userId: 'user_1' })
      ).rejects.toThrow('Coupon usage limit has been reached');
    });
  });

  describe('Duplicate Redemption & Per-User Limit Enforcement', () => {
    it('should prevent user from exceeding perUserLimit', async () => {
      mockCouponRepo.findByCode.mockResolvedValue({
        _id: 'coupon_once_1',
        code: 'WELCOME100',
        discountType: 'FLAT',
        discountValue: 100,
        minOrderValue: 0,
        usageLimit: 1000,
        usedCount: 50,
        perUserLimit: 1, // Single use per customer
        status: 'ACTIVE',
        isActive: true,
        validFrom: new Date(Date.now() - 10000),
        validTo: new Date(Date.now() + 100000),
        deletedAt: null,
      });

      // User has already redeemed this coupon once
      mockCouponRepo.countUserRedemptions.mockResolvedValue(1);

      await expect(
        couponService.validateCoupon('WELCOME100', { amount: 600, userId: 'customer_99' })
      ).rejects.toThrow('You have already used coupon WELCOME100 the maximum allowed times (1)');
    });
  });

  describe('High-Concurrency Atomic Redemption Simulation', () => {
    it('should safely handle 20 concurrent redemptions where only 5 available slots remain', async () => {
      const globalUsageLimit = 5;
      let actualUsedCount = 0;

      // Mock repository atomicRedeem simulating MongoDB atomic document write lock ($expr: { $lt: ['$usedCount', 5] })
      mockCouponRepo.findByCode.mockImplementation(async () => ({
        _id: 'coupon_flash_sale',
        code: 'FLASH5',
        discountType: 'FLAT',
        discountValue: 200,
        minOrderValue: 500,
        usageLimit: globalUsageLimit,
        usedCount: actualUsedCount,
        perUserLimit: 1,
        status: 'ACTIVE',
        isActive: true,
        validFrom: new Date(Date.now() - 10000),
        validTo: new Date(Date.now() + 100000),
        deletedAt: null,
      }));

      mockCouponRepo.countUserRedemptions.mockResolvedValue(0);

      mockCouponRepo.atomicRedeem.mockImplementation(async ({ userId, orderId }) => {
        // Atomic compare-and-swap simulation
        if (actualUsedCount < globalUsageLimit) {
          actualUsedCount++;
          return {
            success: true,
            redemption: {
              _id: `red_${actualUsedCount}`,
              couponCode: 'FLASH5',
              userId,
              orderId,
              status: 'REDEEMED',
            },
          };
        }
        throw new AppError('Coupon usage limit has been reached', 409, 'CONFLICT');
      });

      // Launch 20 concurrent requests simultaneously
      const concurrentRequests = Array.from({ length: 20 }, (_, i) =>
        couponService
          .redeemCoupon({
            code: 'FLASH5',
            amount: 1000,
            userId: `user_${i}`,
            orderId: `order_${i}`,
          })
          .then((res) => ({ status: 'success', data: res }))
          .catch((err) => ({ status: 'failed', error: err.message }))
      );

      const results = await Promise.all(concurrentRequests);

      const successful = results.filter((r) => r.status === 'success');
      const failed = results.filter((r) => r.status === 'failed');

      // Exactly 5 should succeed, 15 should be safely rejected
      expect(successful).toHaveLength(5);
      expect(failed).toHaveLength(15);
      expect(actualUsedCount).toBe(5);
    });

    it('should be idempotent for the same orderId redemption attempt', async () => {
      mockCouponRepo.findByCode.mockResolvedValue({
        _id: 'coupon_idem_1',
        code: 'SAVEMORE',
        discountType: 'FLAT',
        discountValue: 100,
        minOrderValue: 0,
        usageLimit: 100,
        usedCount: 1,
        perUserLimit: 1,
        status: 'ACTIVE',
        isActive: true,
        validFrom: new Date(Date.now() - 10000),
        validTo: new Date(Date.now() + 100000),
        deletedAt: null,
      });
      mockCouponRepo.countUserRedemptions.mockResolvedValue(0);

      mockCouponRepo.atomicRedeem.mockResolvedValue({
        success: true,
        alreadyRedeemed: true,
        redemption: {
          _id: 'red_existing',
          couponCode: 'SAVEMORE',
          orderId: 'order_duplicate_123',
          status: 'REDEEMED',
        },
      });

      const res = await couponService.redeemCoupon({
        code: 'SAVEMORE',
        amount: 500,
        userId: 'user_1',
        orderId: 'order_duplicate_123',
      });

      expect(res.success).toBe(true);
      expect(res.alreadyRedeemed).toBe(true);
    });
  });

  describe('Transaction-Safe Rollback / Release on Failure', () => {
    it('should release coupon and restore usedCount on booking cancellation', async () => {
      mockCouponRepo.atomicRollback.mockResolvedValue({
        rolledBack: true,
        redemption: {
          _id: 'red_cancelled_1',
          couponCode: 'PROMO100',
          orderId: 'order_failed_99',
          status: 'CANCELLED',
        },
      });

      const result = await couponService.releaseCoupon({
        orderId: 'order_failed_99',
        reason: 'Payment gateway timed out',
      });

      expect(result.success).toBe(true);
      expect(result.rolledBack).toBe(true);
      expect(mockCouponRepo.atomicRollback).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order_failed_99',
          reason: 'Payment gateway timed out',
        })
      );
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'coupon.released',
        expect.objectContaining({
          orderId: 'order_failed_99',
        })
      );
    });
  });
});
