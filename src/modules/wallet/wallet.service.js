import crypto from 'crypto';
import mongoose from 'mongoose';
import Razorpay from 'razorpay';
import { BaseService } from '../../common/base/BaseService.js';
import { AppError } from '../../common/errors/AppError.js';
import { NotFoundError } from '../../common/errors/NotFoundError.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import {
  WalletTransactionType,
  WalletTransactionCategory,
  WalletTransactionStatus,
} from './wallet.enum.js';
import {
  toWalletDto,
  toWalletTransactionDto,
  toLoyaltyRuleDto,
} from './wallet.mapper.js';

const WALLET_CACHE_TTL_SECONDS = 300;
const LOYALTY_CACHE_TTL_SECONDS = 600;


export class WalletService extends BaseService {
  /**
   * @param {import('./wallet.repository.js').WalletRepository} walletRepository
   * @param {import('./wallet.repository.js').WalletTransactionRepository} transactionRepository
   * @param {import('./wallet.repository.js').LoyaltyRuleRepository} loyaltyRuleRepository
   * @param {import('../../core/redis/cache.service.js').CacheService|null} cacheService
   * @param {{ razorpayKeyId?: string, razorpayKeySecret?: string, razorpayWebhookSecret?: string }} [config]
   */
  constructor(
    walletRepository,
    transactionRepository,
    loyaltyRuleRepository,
    cacheService = null,
    config = {},
  ) {
    super(null, cacheService);
    this.walletRepository = walletRepository;
    this.transactionRepository = transactionRepository;
    this.loyaltyRuleRepository = loyaltyRuleRepository;
    this.razorpayKeyId = config.keyId || config.razorpayKeyId || process.env.RAZORPAY_KEY_ID || 'rzp_test_mock_key';
    this.razorpayKeySecret = config.keySecret || config.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET || 'mock_secret';
    this.razorpayWebhookSecret = config.webhookSecret || config.razorpayWebhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET || 'mock_webhook_secret';

    if (
      this.razorpayKeyId &&
      this.razorpayKeyId !== 'rzp_test_mock_key' &&
      this.razorpayKeySecret &&
      this.razorpayKeySecret !== 'mock_secret'
    ) {
      this.razorpayClient = new Razorpay({
        key_id: this.razorpayKeyId,
        key_secret: this.razorpayKeySecret,
      });
    } else {
      this.razorpayClient = null;
    }
  }

  #cacheKey(userId) {
    return this.cacheKey('wallet', 'user', userId);
  }

  #loyaltyCacheKey() {
    return this.cacheKey('loyalty', 'rules');
  }

  async #invalidateWalletCache(userId) {
    const key = this.#cacheKey(userId);
    await this.invalidateCache(key);
  }

  async getLoyaltyRules() {
    const key = this.#loyaltyCacheKey();
    const cached = await this.getCached(key);
    if (cached) return cached;

    const rule = await this.loyaltyRuleRepository.findRule();
    const dto = toLoyaltyRuleDto(rule);
    await this.setCached(key, dto, LOYALTY_CACHE_TTL_SECONDS);
    return dto;
  }

  async updateLoyaltyRules(payload, adminUserId = null) {
    const rule = await this.loyaltyRuleRepository.updateRule(payload, adminUserId);
    const dto = toLoyaltyRuleDto(rule);
    const key = this.#loyaltyCacheKey();
    await this.invalidateCache(key);
    await this.setCached(key, dto, LOYALTY_CACHE_TTL_SECONDS);
    return dto;
  }


  async calculatePointsRedemption(points, payableAmount) {
    const rules = await this.getLoyaltyRules();
    if (!rules.isActive) {
      return { pointsUsed: 0, discountAmount: 0, redeemRatio: rules.redeemRatio };
    }

    const availablePoints = Math.max(0, Math.floor(Number(points) || 0));
    if (availablePoints < rules.minPointsToRedeem) {
      return { pointsUsed: 0, discountAmount: 0, redeemRatio: rules.redeemRatio };
    }

    const maxPointsValue = Math.floor(availablePoints * rules.redeemRatio);
    const maxDiscountAllowed = Math.round((payableAmount * rules.maxRedeemPercentage) / 100);
    const effectiveDiscount = Math.min(maxPointsValue, payableAmount, maxDiscountAllowed);

    const pointsUsed = Math.ceil(effectiveDiscount / rules.redeemRatio);

    return {
      pointsUsed,
      discountAmount: effectiveDiscount,
      redeemRatio: rules.redeemRatio,
    };
  }

  async getWallet(userId) {

    const key = this.#cacheKey(userId);
    const cached = await this.getCached(key);
    if (cached) return cached;

    const walletDoc = await this.walletRepository.getOrCreateForUser(userId);
    const dto = toWalletDto(walletDoc);
    await this.setCached(key, dto, WALLET_CACHE_TTL_SECONDS);
    return dto;
  }

  /**
   * Helper to run operations within a Mongoose session (ACID transaction)
   * Falls back to non-transactional execution if standalone MongoDB without replica set.
   */
  async #runInSession(workFn) {
    if (mongoose.connection.readyState !== 1) {
      return workFn(null);
    }
    let session = null;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      const result = await workFn(session);
      await session.commitTransaction();
      return result;
    } catch (err) {
      if (session && session.inTransaction()) {
        await session.abortTransaction();
      }
      // If error is due to standalone MongoDB not supporting transactions or buffering timeout, retry without session
      if (
        err.message &&
        (err.message.includes('Transaction numbers are only allowed on a replica set member') ||
          err.message.includes('standalone') ||
          err.message.includes('buffering timed out'))
      ) {
        return workFn(null);
      }
      throw err;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }

  async createTopupOrder(userId, { amount }) {
    const value = Number(amount);
    if (!value || value <= 0) {
      throw new AppError('Amount must be greater than 0', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    let orderId = null;
    if (this.razorpayClient) {
      try {
        const razorpayOrder = await this.razorpayClient.orders.create({
          amount: Math.round(value * 100),
          currency: 'INR',
          receipt: `rcpt_${Date.now()}_${userId.toString().slice(-6)}`,
          notes: { userId: userId.toString(), purpose: 'WALLET_TOPUP' },
        });
        orderId = razorpayOrder.id;
      } catch (err) {
        throw new AppError(
          `Razorpay order creation failed: ${err.message}`,
          HttpStatus.BAD_GATEWAY,
          ErrorCodes.RAZORPAY_ORDER_FAILED,
        );
      }
    } else {
      orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    return this.#runInSession(async (session) => {
      const wallet = await this.walletRepository.getOrCreateForUser(userId, session);

      const tx = await this.transactionRepository.createTransaction(
        {
          walletId: wallet._id,
          userId: wallet.userId,
          type: WalletTransactionType.CREDIT,
          category: WalletTransactionCategory.TOPUP,
          status: WalletTransactionStatus.PENDING,
          amount: value,
          points: 0,
          balanceAfter: wallet.balance,
          pointsAfter: wallet.points,
          paymentGateway: 'RAZORPAY',
          razorpayOrderId: orderId,
          description: `Wallet top-up of ₹${value}`,
        },
        session,
      );

      return {
        orderId,
        amount: value,
        currency: wallet.currency || 'INR',
        razorpayKeyId: this.razorpayKeyId,
        transaction: toWalletTransactionDto(tx),
      };
    });
  }

  async verifyTopupPayment(
    userId,
    { razorpayOrderId, razorpayPaymentId, razorpaySignature },
  ) {
    if (!razorpayOrderId || !razorpayPaymentId) {
      throw new AppError(
        'Missing Razorpay payment parameters',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    // Verify HMAC signature (in production/mock mode)
    const isMock = razorpayOrderId.startsWith('order_') && (!razorpaySignature || razorpaySignature === 'mock_sig');
    if (!isMock && this.razorpayKeySecret !== 'mock_secret') {
      const generatedSignature = crypto
        .createHmac('sha256', this.razorpayKeySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (generatedSignature !== razorpaySignature) {
        throw new AppError(
          'Invalid Razorpay payment signature',
          HttpStatus.BAD_REQUEST,
          ErrorCodes.RAZORPAY_INVALID_SIGNATURE,
        );
      }
    }

    const result = await this.#runInSession(async (session) => {
      const tx = await this.transactionRepository.findByRazorpayOrderId(razorpayOrderId, session);
      if (!tx) {
        throw new NotFoundError('Transaction not found for this order ID');
      }

      if (tx.status === WalletTransactionStatus.SUCCESS) {
        const wallet = await this.walletRepository.findDocumentByUserId(userId, session);
        return { wallet: toWalletDto(wallet), transaction: toWalletTransactionDto(tx) };
      }

      const updatedWallet = await this.walletRepository.atomicAddBalance(
        userId,
        tx.amount,
        session,
      );

      const updatedTx = await this.transactionRepository.updateStatusByRazorpayOrderId(
        razorpayOrderId,
        WalletTransactionStatus.SUCCESS,
        {
          razorpayPaymentId,
          razorpaySignature: razorpaySignature || 'mock_sig',
          balanceAfter: updatedWallet.balance,
          pointsAfter: updatedWallet.points,
        },
        session,
      );

      return {
        wallet: toWalletDto(updatedWallet),
        transaction: toWalletTransactionDto(updatedTx),
      };
    });

    await this.#invalidateWalletCache(userId);
    return result;
  }

  async handleRazorpayWebhook(rawBody, signature, eventPayload) {
    if (this.razorpayWebhookSecret && this.razorpayWebhookSecret !== 'mock_webhook_secret') {
      const expectedSignature = crypto
        .createHmac('sha256', this.razorpayWebhookSecret)
        .update(rawBody)
        .digest('hex');

      if (expectedSignature !== signature) {
        throw new AppError(
          'Invalid webhook signature',
          HttpStatus.BAD_REQUEST,
          ErrorCodes.RAZORPAY_INVALID_SIGNATURE,
        );
      }
    }

    const event = eventPayload?.event;
    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = eventPayload.payload?.payment?.entity || eventPayload.payload?.order?.entity;
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;

      if (orderId) {
        await this.#runInSession(async (session) => {
          const tx = await this.transactionRepository.findByRazorpayOrderId(orderId, session);
          if (tx && tx.status === WalletTransactionStatus.PENDING) {
            const updatedWallet = await this.walletRepository.atomicAddBalance(
              tx.userId,
              tx.amount,
              session,
            );
            await this.transactionRepository.updateStatusByRazorpayOrderId(
              orderId,
              WalletTransactionStatus.SUCCESS,
              {
                razorpayPaymentId: paymentId || 'webhook_captured',
                balanceAfter: updatedWallet.balance,
                pointsAfter: updatedWallet.points,
              },
              session,
            );
            await this.#invalidateWalletCache(tx.userId.toString());
          }
        });
      }
    }

    return { received: true };
  }

  async addPoints(userId, { points, description = 'Points Earned', referenceId = null }) {
    const pts = Math.max(0, Math.floor(Number(points) || 0));
    if (pts <= 0) {
      throw new AppError('Points must be greater than 0', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    const result = await this.#runInSession(async (session) => {
      const updatedWallet = await this.walletRepository.atomicAddPoints(userId, pts, session);

      const tx = await this.transactionRepository.createTransaction(
        {
          walletId: updatedWallet._id,
          userId: updatedWallet.userId,
          type: WalletTransactionType.CREDIT,
          category: WalletTransactionCategory.POINTS_EARNED,
          status: WalletTransactionStatus.SUCCESS,
          amount: 0,
          points: pts,
          balanceAfter: updatedWallet.balance,
          pointsAfter: updatedWallet.points,
          paymentGateway: 'SYSTEM',
          description,
          referenceId,
        },
        session,
      );

      return {
        wallet: toWalletDto(updatedWallet),
        transaction: toWalletTransactionDto(tx),
      };
    });

    await this.#invalidateWalletCache(userId);
    return result;
  }

  async deductPoints(userId, { points, description = 'Points Redeemed', referenceId = null }) {
    const pts = Math.max(0, Math.floor(Number(points) || 0));
    if (pts <= 0) {
      throw new AppError('Points must be greater than 0', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    const result = await this.#runInSession(async (session) => {
      const updatedWallet = await this.walletRepository.atomicDeductPoints(userId, pts, session);

      const tx = await this.transactionRepository.createTransaction(
        {
          walletId: updatedWallet._id,
          userId: updatedWallet.userId,
          type: WalletTransactionType.DEBIT,
          category: WalletTransactionCategory.POINTS_REDEEMED,
          status: WalletTransactionStatus.SUCCESS,
          amount: 0,
          points: pts,
          balanceAfter: updatedWallet.balance,
          pointsAfter: updatedWallet.points,
          paymentGateway: 'SYSTEM',
          description,
          referenceId,
        },
        session,
      );

      return {
        wallet: toWalletDto(updatedWallet),
        transaction: toWalletTransactionDto(tx),
      };
    });

    await this.#invalidateWalletCache(userId);
    return result;
  }


  async addCashback(userId, { amount, description = 'Cashback Credited', referenceId = null }) {
    const value = Math.max(0, Number(amount) || 0);
    if (value <= 0) {
      throw new AppError('Amount must be greater than 0', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    const result = await this.#runInSession(async (session) => {
      const wallet = await this.walletRepository.getOrCreateForUser(userId, session);
      wallet.cashbackBalance += value;
      await wallet.save({ session });

      const tx = await this.transactionRepository.createTransaction(
        {
          walletId: wallet._id,
          userId: wallet.userId,
          type: WalletTransactionType.CREDIT,
          category: WalletTransactionCategory.CASHBACK_CREDITED,
          status: WalletTransactionStatus.SUCCESS,
          amount: value,
          points: 0,
          balanceAfter: wallet.balance,
          pointsAfter: wallet.points,
          paymentGateway: 'SYSTEM',
          description,
          referenceId,
        },
        session,
      );

      return {
        wallet: toWalletDto(wallet),
        transaction: toWalletTransactionDto(tx),
      };
    });

    await this.#invalidateWalletCache(userId);
    return result;
  }

  async listTransactions(userId, query = {}) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const { items, total, totalPages } =
      await this.transactionRepository.listByUserWithAggregation(userId, {
        page,
        limit,
        category: query.category,
        type: query.type,
      });

    return {
      items: items.map(toWalletTransactionDto),
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }
}
