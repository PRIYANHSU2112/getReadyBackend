import { ValidationError } from '../../common/errors/ValidationError.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';

/**
 * Coupon provider interface:
 *   resolveCoupon(code, { userId, subtotal }) => Promise<{ code, discountAmount } | null>
 */

export class StubCouponProvider {
  /**
   * @param {string|null} code
   * @param {{ userId: string, subtotal: number }} _ctx
   * @returns {Promise<{ code: string, discountAmount: number }|null>}
   */
  async resolveCoupon(code, _ctx) {
    if (!code) return null;
    throw new ValidationError('Coupon is not available yet', [
      {
        field: 'couponCode',
        message: 'Coupon service is not configured',
        code: ErrorCodes.CART_COUPON_INVALID,
      },
    ]);
  }
}

/**
 * Points / cashback / membership stubs until loyalty modules exist.
 */
export class StubPointsProvider {
  async getBalance(_userId) {
    return 0;
  }
}

export class StubCashbackProvider {
  async getBalance(_userId) {
    return 0;
  }
}

export class StubMembershipProvider {
  /**
   * @param {string} _userId
   * @returns {Promise<boolean>}
   */
  async hasActiveMembership(_userId) {
    return false;
  }
}
