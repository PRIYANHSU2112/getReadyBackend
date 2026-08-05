import { ValidationError } from '../../common/errors/ValidationError.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';

/**
 * Wallet provider interface (swap with real Wallet module later):
 *   getBalance(userId) => Promise<number>
 *
 * Coupon provider interface (swap with real Coupon module later):
 *   resolveCoupon(code, { userId, subtotal }) => Promise<{ code, discountAmount } | null>
 */

export class StubWalletProvider {
  /**
   * @param {string} _userId
   * @returns {Promise<number>}
   */
  async getBalance(_userId) {
    return 0;
  }
}

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
 * Credits / cashback stubs — balance 0 until loyalty modules exist.
 */
export class StubCreditsProvider {
  async getBalance(_userId) {
    return 0;
  }
}

export class StubCashbackProvider {
  async getBalance(_userId) {
    return 0;
  }
}
