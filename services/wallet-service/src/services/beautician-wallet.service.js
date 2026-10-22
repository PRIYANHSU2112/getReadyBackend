import mongoose from 'mongoose';
import { AppError, HttpStatus, ErrorCodes, ConflictError, ValidationError, NotFoundError } from '@getready/errors';
import {
  WalletType,
  WalletTransactionType,
  WalletTransactionCategory,
  WalletTransactionStatus,
  PayoutStatus,
  PayoutDestinationType,
} from '../models/wallet.enum.js';
import { WalletModel, WalletTransactionModel } from '../models/wallet.model.js';
import { PayoutRequestModel } from '../models/payout-request.model.js';
import { walletCache } from '../cache/wallet.cache.js';
import { config } from '../config/index.js';
import { logger } from '@getready/logger';

export class BeauticianWalletService {
  constructor(walletRepository, transactionRepository, payoutRepository, payoutConfigRepository = null, publisher = null) {
    this.walletRepo = walletRepository;
    this.txRepo = transactionRepository;
    this.payoutRepo = payoutRepository;
    this.payoutConfigRepo = payoutConfigRepository;
    this.publisher = publisher;
  }

  /**
   * Dynamic Payout & Commission Config (Cached for ultra-fast access)
   */
  async getPayoutConfig() {
    const cacheKey = 'wallet:config:payout';
    const cached = await walletCache.get(cacheKey);
    if (cached) return cached;

    let cfg = null;
    if (this.payoutConfigRepo) {
      cfg = await this.payoutConfigRepo.getConfig();
    } else {
      cfg = {
        minWithdrawalAmount: 100,
        maxWithdrawalAmount: 50000,
        defaultCommissionPercentage: 10,
        dailyWithdrawalLimit: 25000,
        allowUpiPayout: true,
        allowBankPayout: true,
      };
    }

    await walletCache.set(cacheKey, cfg, 120);
    return cfg;
  }

  async updatePayoutConfig(data, adminUserId = null) {
    if (!this.payoutConfigRepo) {
      throw new AppError('PayoutConfigRepository not configured', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    const updated = await this.payoutConfigRepo.updateConfig(data, adminUserId);
    await walletCache.del('wallet:config:payout');
    return updated;
  }


  /**
   * Ultra-fast Dashboard: < 50ms with Redis/L1, < 200ms DB
   */
  async getDashboard(userId) {
    const uid = String(userId);
    const cacheKey = `wallet:beautician:${uid}:dashboard`;

    // 1. Try cache first
    const cached = await walletCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. Query wallet and recent transactions concurrently
    const [wallet, recentTx] = await Promise.all([
      this.walletRepo.getOrCreateForUser(uid, WalletType.BEAUTICIAN),
      this.txRepo.listRecent(uid, 5),
    ]);

    const formattedTransactions = recentTx.map((tx) => this.#formatTransaction(tx));

    const result = {
      walletId: wallet.walletNumber || `GRBTW${wallet._id.toString().slice(-6).toUpperCase()}`,
      currency: wallet.currency || 'INR',
      balance: wallet.balance || 0,
      availableBalance: wallet.balance || 0,
      monthlyEarnings: wallet.currentMonthEarnings || 0,
      totalWithdrawal: wallet.totalWithdrawnLifetime || 0,
      pendingWithdrawal: wallet.pendingWithdrawalBalance || 0,
      totalEarnedLifetime: wallet.totalEarnedLifetime || 0,
      recentTransactions: formattedTransactions,
    };

    // 3. Cache for 60 seconds
    await walletCache.set(cacheKey, result, 60);

    return result;
  }

  /**
   * Paginated transactions list for EarningsHistoryScreen
   */
  async getTransactions(userId, { type = 'all', page = 1, limit = 20 } = {}) {
    const uid = String(userId);
    const skip = (Math.max(1, page) - 1) * limit;

    let category = null;
    let txType = null;

    if (type === 'service') {
      category = WalletTransactionCategory.SERVICE_EARNING;
    } else if (type === 'withdrawal') {
      category = WalletTransactionCategory.WITHDRAWAL;
    }

    const { transactions, total } = await this.txRepo.listByUser(uid, {
      limit,
      skip,
      type: txType,
      category,
    });

    return {
      transactions: transactions.map((tx) => this.#formatTransaction(tx)),
      total,
      page: Math.max(1, page),
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Transaction details for TransactionDetailsScreen
   */
  async getTransactionDetails(userId, transactionId) {
    const tx = await this.txRepo.findById(transactionId);
    if (!tx || String(tx.userId) !== String(userId)) {
      throw new NotFoundError('Transaction not found');
    }
    return this.#formatTransaction(tx);
  }

  /**
   * ACID Payout Request: Zero race condition with atomic balance locking
   */
  async requestPayout(userId, { amount, payoutType = PayoutDestinationType.BANK_ACCOUNT, bankName, accountNumber, ifscCode, upiId, accountHolderName }) {
    const uid = String(userId);
    const parsedAmount = parseFloat(amount);

    const payoutConfig = await this.getPayoutConfig();
    const minAmount = payoutConfig?.minWithdrawalAmount || 100;
    const maxAmount = payoutConfig?.maxWithdrawalAmount || 50000;

    if (isNaN(parsedAmount) || parsedAmount < minAmount) {
      throw new ValidationError(`Minimum withdrawal amount is ₹${minAmount}`);
    }

    if (parsedAmount > maxAmount) {
      throw new ValidationError(`Maximum withdrawal amount per request is ₹${maxAmount}`);
    }

    if (payoutType === PayoutDestinationType.BANK_ACCOUNT) {
      if (payoutConfig.allowBankPayout === false) {
        throw new ValidationError('Bank account payouts are currently disabled by administrator');
      }
      if (!bankName || !accountNumber) {
        throw new ValidationError('Bank name and account number are required for bank payout');
      }
    }

    if (payoutType === PayoutDestinationType.UPI) {
      if (payoutConfig.allowUpiPayout === false) {
        throw new ValidationError('UPI payouts are currently disabled by administrator');
      }
      if (!upiId) {
        throw new ValidationError('UPI ID is required for UPI payout');
      }
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. ATOMIC LOCK: Deduct from balance and add to pendingWithdrawalBalance in ONE atomic query.
      // If available balance < amount, this query matches 0 documents and returns null.
      const updatedWallet = await WalletModel.findOneAndUpdate(
        {
          userId: uid,
          walletType: WalletType.BEAUTICIAN,
          balance: { $gte: parsedAmount },
        },
        {
          $inc: {
            balance: -parsedAmount,
            pendingWithdrawalBalance: parsedAmount,
          },
        },
        { new: true, session },
      );

      if (!updatedWallet) {
        throw new ConflictError('Insufficient available balance for withdrawal');
      }

      // 2. Create Payout Request
      const maskedAccount = accountNumber ? `•••• ${String(accountNumber).slice(-4)}` : null;
      const payoutNumber = `WT-${Math.floor(1000 + Math.random() * 9000)}-XM${Math.floor(10 + Math.random() * 90)}`;

      const payout = new PayoutRequestModel({
        payoutNumber,
        beauticianId: uid,
        amount: parsedAmount,
        destination: {
          payoutType,
          bankName,
          accountNumberMasked: maskedAccount,
          ifscCode,
          upiId,
          accountHolderName,
        },
        status: PayoutStatus.REQUESTED,
        statusHistory: [
          {
            status: PayoutStatus.REQUESTED,
            timestamp: new Date(),
            actor: 'BEAUTICIAN',
            notes: 'Withdrawal requested via Beautician App',
          },
        ],
      });
      await payout.save({ session });

      // 3. Create Debit Transaction Record
      const tx = new WalletTransactionModel({
        walletId: updatedWallet._id,
        userId: uid,
        title: payoutType === PayoutDestinationType.UPI ? `Withdrawal via UPI (${upiId})` : `Withdrawal to ${bankName || 'Bank'}`,
        type: WalletTransactionType.DEBIT,
        category: WalletTransactionCategory.WITHDRAWAL,
        amount: -parsedAmount,
        balanceAfter: updatedWallet.balance,
        status: WalletTransactionStatus.PENDING,
        referenceId: payoutNumber,
        bankName,
        accountNumber: maskedAccount ? String(accountNumber).slice(-4) : null,
        upiId,
        customerName: 'Self Withdrawal',
        description: `Withdrawal request #${payoutNumber}`,
        metadata: { payoutId: payout._id.toString() },
      });
      await tx.save({ session });

      payout.transactionId = tx._id;
      await payout.save({ session });

      await session.commitTransaction();

      // Invalidate cache immediately
      await walletCache.invalidateBeautician(uid);

      if (this.publisher) {
        await this.publisher
          .publishDomainEvent('PayoutRequested', {
            payoutId: payout._id.toString(),
            payoutNumber,
            beauticianId: uid,
            amount: parsedAmount,
            destination: payout.destination,
          })
          .catch(() => {});
      }

      return {
        success: true,
        transactionId: payoutNumber,
        payoutNumber,
        amount: parsedAmount,
        bankName,
        accountEnding: maskedAccount ? String(accountNumber).slice(-4) : null,
        status: PayoutStatus.REQUESTED,
        wallet: {
          availableBalance: updatedWallet.balance,
          pendingWithdrawal: updatedWallet.pendingWithdrawalBalance,
        },
      };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  /**
   * Atomic Credit for Beautician Service Earnings (called when Booking is COMPLETED)
   */
  async creditBookingEarnings(beauticianId, { bookingId, bookingNumber, grossAmount = 0, commissionAmount, netPayoutAmount, customerName = 'Customer', serviceNames = 'Salon Service' }) {
    const uid = String(beauticianId);

    let finalCommission = commissionAmount;
    let payoutAmount = netPayoutAmount;

    if (payoutAmount === undefined || payoutAmount === null) {
      const payoutConfig = await this.getPayoutConfig();
      const commPercent = payoutConfig?.defaultCommissionPercentage ?? 10;
      finalCommission = Math.round(grossAmount * (commPercent / 100));
      payoutAmount = Math.max(0, grossAmount - finalCommission);
    }

    if (payoutAmount <= 0) {
      logger.warn({ beauticianId, bookingId, payoutAmount }, 'Skipping creditBookingEarnings: payout amount is zero');
      return null;
    }

    const idempotencyKey = `earning_${bookingId}_${uid}`;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Check if already credited for this booking
      const existingTx = await WalletTransactionModel.findOne({ idempotencyKey }).session(session);
      if (existingTx) {
        await session.abortTransaction();
        logger.info({ idempotencyKey }, 'Booking earnings already credited, skipping duplicate');
        return existingTx;
      }

      // 2. Atomically update Beautician Wallet
      const wallet = await WalletModel.findOneAndUpdate(
        { userId: uid, walletType: WalletType.BEAUTICIAN },
        {
          $inc: {
            balance: payoutAmount,
            totalEarnedLifetime: payoutAmount,
            currentMonthEarnings: payoutAmount,
          },
        },
        { upsert: true, new: true, session },
      );

      // 3. Log credit transaction
      const tx = new WalletTransactionModel({
        walletId: wallet._id,
        userId: uid,
        title: serviceNames || `Service: #${bookingNumber}`,
        type: WalletTransactionType.CREDIT,
        category: WalletTransactionCategory.SERVICE_EARNING,
        amount: payoutAmount,
        balanceAfter: wallet.balance,
        status: WalletTransactionStatus.COMPLETED,
        referenceId: `BID#${bookingNumber || bookingId}`,
        customerName,
        idempotencyKey,
        description: `Service earnings for completed booking #${bookingNumber || bookingId}`,
        metadata: {
          bookingId,
          bookingNumber,
          grossAmount,
          commissionAmount,
          netPayoutAmount: payoutAmount,
        },
      });
      await tx.save({ session });

      await session.commitTransaction();

      // Invalidate cache immediately
      await walletCache.invalidateBeautician(uid);

      logger.info(
        { beauticianId: uid, bookingId, payoutAmount, balanceAfter: wallet.balance },
        'Successfully credited beautician service earnings',
      );

      return tx;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  /**
   * Admin Process Payout (Approve or Reject with Auto-Refund)
   */
  async adminProcessPayout(payoutId, adminUserId, { action, transactionRef = null, reason = null }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const payout = await this.payoutRepo.findById(payoutId, session);
      if (!payout) throw new NotFoundError('Payout request not found');

      if (payout.status !== PayoutStatus.REQUESTED && payout.status !== PayoutStatus.PROCESSING) {
        throw new ConflictError(`Cannot ${action} payout with status ${payout.status}`);
      }

      const uid = String(payout.beauticianId);

      if (action === 'APPROVE') {
        // Funds were already deducted from available balance; now clear pendingWithdrawalBalance
        await WalletModel.findOneAndUpdate(
          { userId: uid, walletType: WalletType.BEAUTICIAN },
          {
            $inc: {
              pendingWithdrawalBalance: -payout.amount,
              totalWithdrawnLifetime: payout.amount,
            },
          },
          { session },
        );

        payout.status = PayoutStatus.COMPLETED;
        payout.processedBy = adminUserId;
        payout.processedAt = new Date();
        payout.razorpayPayoutId = transactionRef;
        payout.statusHistory.push({
          status: PayoutStatus.COMPLETED,
          timestamp: new Date(),
          actor: 'ADMIN',
          notes: `Payout approved by admin. Ref: ${transactionRef || 'N/A'}`,
        });
        await payout.save({ session });

        // Update transaction status
        if (payout.transactionId) {
          await WalletTransactionModel.findByIdAndUpdate(
            payout.transactionId,
            { status: WalletTransactionStatus.COMPLETED },
            { session },
          );
        }
      } else if (action === 'REJECT') {
        // AUTO-REFUND: Restore funds back to available balance!
        const restoredWallet = await WalletModel.findOneAndUpdate(
          { userId: uid, walletType: WalletType.BEAUTICIAN },
          {
            $inc: {
              pendingWithdrawalBalance: -payout.amount,
              balance: payout.amount,
            },
          },
          { new: true, session },
        );

        payout.status = PayoutStatus.REJECTED;
        payout.processedBy = adminUserId;
        payout.processedAt = new Date();
        payout.adminNotes = reason || 'Payout rejected by administrator';
        payout.statusHistory.push({
          status: PayoutStatus.REJECTED,
          timestamp: new Date(),
          actor: 'ADMIN',
          notes: reason || 'Payout rejected by administrator',
        });
        await payout.save({ session });

        // Update debit transaction to failed
        if (payout.transactionId) {
          await WalletTransactionModel.findByIdAndUpdate(
            payout.transactionId,
            { status: WalletTransactionStatus.FAILED },
            { session },
          );
        }

        // Log refund transaction
        const refundTx = new WalletTransactionModel({
          walletId: restoredWallet._id,
          userId: uid,
          title: 'Payout Reversal / Refund',
          type: WalletTransactionType.CREDIT,
          category: WalletTransactionCategory.WITHDRAWAL_REFUND,
          amount: payout.amount,
          balanceAfter: restoredWallet.balance,
          status: WalletTransactionStatus.COMPLETED,
          referenceId: payout.payoutNumber,
          customerName: 'System Reversal',
          description: `Withdrawal refund for rejected payout #${payout.payoutNumber}: ${reason || 'Admin rejected'}`,
        });
        await refundTx.save({ session });
      } else {
        throw new ValidationError(`Unknown action: ${action}. Must be APPROVE or REJECT`);
      }

      await session.commitTransaction();

      // Invalidate cache immediately
      await walletCache.invalidateBeautician(uid);

      return payout;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  #formatTransaction(tx) {
    const rawAmount = tx.amount || 0;
    const isDebit = tx.type === WalletTransactionType.DEBIT || rawAmount < 0;
    const dateObj = tx.createdAt ? new Date(tx.createdAt) : new Date();

    const formattedDate = dateObj.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const formattedTime = dateObj.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    return {
      id: tx._id?.toString() || tx.id,
      title: tx.title || (isDebit ? 'Withdrawal' : 'Service Earning'),
      dateTime: `${formattedDate} · ${formattedTime}`,
      referenceId: tx.referenceId || `TX-${tx._id?.toString().slice(-6).toUpperCase()}`,
      amount: rawAmount,
      type: isDebit ? 'debit' : 'credit',
      category: tx.category === WalletTransactionCategory.WITHDRAWAL ? 'withdrawal' : 'service',
      status: String(tx.status || 'completed').toLowerCase(),
      bankName: tx.bankName || null,
      accountNumber: tx.accountNumber || null,
      upiId: tx.upiId || null,
      customerName: tx.customerName || (isDebit ? 'Self Withdrawal' : 'Customer'),
      description: tx.description || null,
    };
  }
}
