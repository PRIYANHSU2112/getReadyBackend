import crypto from 'crypto';
import mongoose from 'mongoose';
import Razorpay from 'razorpay';
import { AppError, NotFoundError, ValidationError, ConflictError } from '@getready/errors';
import {
  WalletTransactionType,
  WalletTransactionCategory,
  WalletTransactionStatus,
} from '../models/wallet.enum.js';
import {
  toWalletDto,
  toWalletTransactionDto,
  toLoyaltyRuleDto,
} from './wallet.mapper.js';
import { config } from '../config/index.js';
import { walletCreditsTotal, walletDebitsTotal } from '@getready/metrics';
import { logger } from '@getready/logger';

export class WalletService {
  constructor(walletRepository, transactionRepository, loyaltyRuleRepository, publisher = null) {
    this.walletRepository = walletRepository;
    this.transactionRepository = transactionRepository;
    this.loyaltyRuleRepository = loyaltyRuleRepository;
    this.publisher = publisher;

    if (
      config.razorpay.keyId &&
      config.razorpay.keyId !== 'rzp_test_mock_key' &&
      config.razorpay.keySecret &&
      config.razorpay.keySecret !== 'mock_secret'
    ) {
      this.razorpayClient = new Razorpay({
        key_id: config.razorpay.keyId,
        key_secret: config.razorpay.keySecret,
      });
    } else {
      this.razorpayClient = null;
    }
  }

  async getLoyaltyRules() {
    const rule = await this.loyaltyRuleRepository.findRule();
    return toLoyaltyRuleDto(rule);
  }

  async updateLoyaltyRules(payload, adminUserId = null) {
    const rule = await this.loyaltyRuleRepository.updateRule(payload, adminUserId);
    return toLoyaltyRuleDto(rule);
  }

  async getWallet(userId) {
    const wallet = await this.walletRepository.getOrCreateForUser(userId);
    return toWalletDto(wallet);
  }

  async createTopupOrder(userId, amount) {
    if (amount <= 0) throw new ValidationError('Amount must be positive');

    const wallet = await this.walletRepository.getOrCreateForUser(userId);
    const amountInPaise = Math.round(amount * 100);

    let orderId = `order_mock_${Date.now()}`;
    if (this.razorpayClient) {
      const rzpOrder = await this.razorpayClient.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `wallet_${wallet._id}_${Date.now()}`,
        notes: { userId: String(userId), type: 'WALLET_TOPUP' },
      });
      orderId = rzpOrder.id;
    }

    await this.transactionRepository.create({
      walletId: wallet._id,
      userId,
      type: WalletTransactionType.CREDIT,
      category: WalletTransactionCategory.TOPUP,
      amount,
      balanceAfter: wallet.balance,
      status: WalletTransactionStatus.PENDING,
      razorpayOrderId: orderId,
      description: 'Wallet topup order initiated',
    });

    return {
      orderId,
      amount,
      currency: 'INR',
      keyId: config.razorpay.keyId,
    };
  }

  async verifyTopupPayment(userId, { orderId, paymentId, signature }) {
    const txn = await this.transactionRepository.findByRazorpayOrderId(orderId);
    if (!txn) throw new NotFoundError('Topup transaction not found');

    if (txn.status === WalletTransactionStatus.COMPLETED) {
      const wallet = await this.walletRepository.findByUserId(userId);
      return toWalletDto(wallet);
    }

    // Signature verification
    if (this.razorpayClient && signature) {
      const body = orderId + '|' + paymentId;
      const expectedSignature = crypto
        .createHmac('sha256', config.razorpay.keySecret)
        .update(body.toString())
        .digest('hex');

      if (expectedSignature !== signature) {
        txn.status = WalletTransactionStatus.FAILED;
        await txn.save();
        throw new ValidationError('Invalid payment signature');
      }
    }

    // Atomic wallet credit
    const wallet = await this.walletRepository.getOrCreateForUser(userId);
    wallet.balance += txn.amount;
    await this.walletRepository.save(wallet);

    txn.status = WalletTransactionStatus.COMPLETED;
    txn.razorpayPaymentId = paymentId;
    txn.balanceAfter = wallet.balance;
    await txn.save();

    walletCreditsTotal.inc({ service: 'wallet-service', category: 'TOPUP' });

    if (this.publisher) {
      await this.publisher.publishDomainEvent('WalletCredited', {
        userId,
        amount: txn.amount,
        balance: wallet.balance,
        category: 'TOPUP',
      }, { aggregateId: String(wallet._id) });
    }

    return toWalletDto(wallet);
  }

  async creditWallet(userId, amount, category = WalletTransactionCategory.ADMIN_ADJUSTMENT, referenceId = null, description = '', metadata = {}) {
    if (amount <= 0) throw new ValidationError('Credit amount must be greater than zero');

    const wallet = await this.walletRepository.getOrCreateForUser(userId);
    wallet.balance += amount;
    await this.walletRepository.save(wallet);

    const txn = await this.transactionRepository.create({
      walletId: wallet._id,
      userId,
      type: WalletTransactionType.CREDIT,
      category,
      amount,
      balanceAfter: wallet.balance,
      status: WalletTransactionStatus.COMPLETED,
      referenceId,
      description,
      metadata,
    });

    walletCreditsTotal.inc({ service: 'wallet-service', category });

    if (this.publisher) {
      await this.publisher.publishDomainEvent('WalletCredited', {
        userId,
        amount,
        balance: wallet.balance,
        category,
        referenceId,
      }, { aggregateId: String(wallet._id) });
    }

    return { wallet: toWalletDto(wallet), transaction: toWalletTransactionDto(txn) };
  }

  async debitWallet(userId, amount, category = WalletTransactionCategory.BOOKING_PAYMENT, referenceId = null, description = '', metadata = {}) {
    if (amount <= 0) throw new ValidationError('Debit amount must be greater than zero');

    const wallet = await this.walletRepository.getOrCreateForUser(userId);
    if (wallet.balance < amount) {
      throw new ValidationError('Insufficient wallet balance');
    }

    wallet.balance -= amount;
    await this.walletRepository.save(wallet);

    const txn = await this.transactionRepository.create({
      walletId: wallet._id,
      userId,
      type: WalletTransactionType.DEBIT,
      category,
      amount,
      balanceAfter: wallet.balance,
      status: WalletTransactionStatus.COMPLETED,
      referenceId,
      description,
      metadata,
    });

    walletDebitsTotal.inc({ service: 'wallet-service', category });

    if (this.publisher) {
      await this.publisher.publishDomainEvent('WalletDebited', {
        userId,
        amount,
        balance: wallet.balance,
        category,
        referenceId,
      }, { aggregateId: String(wallet._id) });
    }

    return { wallet: toWalletDto(wallet), transaction: toWalletTransactionDto(txn) };
  }

  async addPoints(userId, points, reason = 'Loyalty points added', referenceId = null) {
    if (points <= 0) throw new ValidationError('Points must be positive');

    const wallet = await this.walletRepository.getOrCreateForUser(userId);
    wallet.points += points;
    wallet.totalPointsEarned += points;
    await this.walletRepository.save(wallet);

    await this.transactionRepository.create({
      walletId: wallet._id,
      userId,
      type: WalletTransactionType.CREDIT,
      category: WalletTransactionCategory.LOYALTY_POINTS_EARNED,
      amount: 0,
      points,
      balanceAfter: wallet.balance,
      pointsBalanceAfter: wallet.points,
      status: WalletTransactionStatus.COMPLETED,
      referenceId,
      description: reason,
    });

    return toWalletDto(wallet);
  }

  async deductPoints(userId, points, reason = 'Loyalty points redeemed', referenceId = null) {
    if (points <= 0) throw new ValidationError('Points must be positive');

    const wallet = await this.walletRepository.getOrCreateForUser(userId);
    if (wallet.points < points) {
      throw new ValidationError('Insufficient points balance');
    }

    wallet.points -= points;
    await this.walletRepository.save(wallet);

    await this.transactionRepository.create({
      walletId: wallet._id,
      userId,
      type: WalletTransactionType.DEBIT,
      category: WalletTransactionCategory.LOYALTY_POINTS_REDEEMED,
      amount: 0,
      points,
      balanceAfter: wallet.balance,
      pointsBalanceAfter: wallet.points,
      status: WalletTransactionStatus.COMPLETED,
      referenceId,
      description: reason,
    });

    return toWalletDto(wallet);
  }

  async listTransactions(userId, options) {
    const { transactions, total } = await this.transactionRepository.listByUser(userId, options);
    return {
      transactions: transactions.map(toWalletTransactionDto),
      total,
    };
  }

  async handleRazorpayWebhook(payload, signature) {
    if (config.razorpay.webhookSecret && config.razorpay.webhookSecret !== 'mock_webhook_secret') {
      const expectedSignature = crypto
        .createHmac('sha256', config.razorpay.webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      if (expectedSignature !== signature) {
        throw new ValidationError('Invalid webhook signature');
      }
    }

    const event = payload.event;
    if (event === 'payment.captured') {
      const payment = payload.payload?.payment?.entity;
      const orderId = payment?.order_id;
      if (orderId) {
        const txn = await this.transactionRepository.findByRazorpayOrderId(orderId);
        if (txn && txn.status === WalletTransactionStatus.PENDING) {
          const wallet = await this.walletRepository.getOrCreateForUser(txn.userId);
          wallet.balance += txn.amount;
          await this.walletRepository.save(wallet);

          txn.status = WalletTransactionStatus.COMPLETED;
          txn.razorpayPaymentId = payment.id;
          txn.balanceAfter = wallet.balance;
          await txn.save();
        }
      }
    }

    return { received: true };
  }

  async listWallets(queryParams = {}) {
    const {
      page = 1,
      limit = 25,
      search,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = queryParams;

    const filter = {};

    if (status && status !== 'all' && status !== 'ALL') {
      filter.status = status.toUpperCase();
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ walletNumber: regex }];
    }

    const parsedLimit = Math.min(Math.max(1, parseInt(limit, 10) || 25), 100);
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);

    return this.walletRepository.findWithPagination({
      filter,
      page: parsedPage,
      limit: parsedLimit,
      sortBy,
      sortOrder,
    });
  }

  async getKpis() {
    return this.walletRepository.getKpis();
  }

  async createWalletManual(data) {
    const userId = data.userId || new mongoose.Types.ObjectId();
    const wallet = await this.walletRepository.getOrCreateForUser(userId);
    if (data.balance) wallet.balance = Number(data.balance);
    if (data.status) wallet.status = data.status;
    await this.walletRepository.save(wallet);
    return toWalletDto(wallet);
  }

  async updateWallet(id, data) {
    const wallet = await this.walletRepository.update(id, data);
    if (!wallet) throw new NotFoundError('Wallet not found');
    return toWalletDto(wallet);
  }

  async deleteWallet(id) {
    const wallet = await this.walletRepository.update(id, { status: 'INACTIVE', isActive: false });
    if (!wallet) throw new NotFoundError('Wallet not found');
    return { id, deleted: true };
  }
}
