import { describe, it, expect, jest } from '@jest/globals';
import { WalletService } from '../../../modules/wallet/wallet.service.js';
import { WalletTransactionStatus, WalletTransactionType, WalletTransactionCategory } from '../../../modules/wallet/wallet.enum.js';
import { ErrorCodes } from '../../../common/constants/error-codes.js';
import { AppError } from '../../../common/errors/AppError.js';

describe('WalletService (unit)', () => {
  it('creates top-up order and logs pending transaction', async () => {
    const walletDoc = {
      _id: '64f0c2a1b4e1c2d3e4f50900',
      userId: '507f1f77bcf86cd799439011',
      balance: 100,
      points: 50,
      currency: 'INR',
    };
    const walletRepository = {
      getOrCreateForUser: jest.fn().mockResolvedValue(walletDoc),
    };
    const transactionRepository = {
      createTransaction: jest.fn().mockImplementation(async (data) => ({
        _id: '64f0c2a1b4e1c2d3e4f50901',
        ...data,
      })),
    };

    const service = new WalletService(walletRepository, transactionRepository, null);

    const result = await service.createTopupOrder('507f1f77bcf86cd799439011', { amount: 500 });

    expect(result.amount).toBe(500);
    expect(result.orderId).toContain('order_');
    expect(transactionRepository.createTransaction).toHaveBeenCalled();
  });

  it('verifies topup payment and credits balance', async () => {
    const walletDoc = {
      _id: '64f0c2a1b4e1c2d3e4f50900',
      userId: '507f1f77bcf86cd799439011',
      balance: 600,
      points: 50,
      currency: 'INR',
    };
    const pendingTx = {
      _id: '64f0c2a1b4e1c2d3e4f50901',
      walletId: walletDoc._id,
      userId: walletDoc.userId,
      amount: 500,
      status: WalletTransactionStatus.PENDING,
    };

    const walletRepository = {
      atomicAddBalance: jest.fn().mockResolvedValue(walletDoc),
      findDocumentByUserId: jest.fn().mockResolvedValue(walletDoc),
    };
    const transactionRepository = {
      findByRazorpayOrderId: jest.fn().mockResolvedValue(pendingTx),
      updateStatusByRazorpayOrderId: jest.fn().mockImplementation(async (orderId, status, details) => ({
        ...pendingTx,
        status,
        ...details,
      })),
    };

    const service = new WalletService(walletRepository, transactionRepository, null, {
      razorpayKeySecret: 'mock_secret',
    });

    const verified = await service.verifyTopupPayment('507f1f77bcf86cd799439011', {
      razorpayOrderId: 'order_123',
      razorpayPaymentId: 'pay_123',
      razorpaySignature: 'mock_sig',
    });

    expect(walletRepository.atomicAddBalance).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      500,
      null,
    );
    expect(verified.wallet.balance).toBe(600);
  });

  it('adds points and logs points credit transaction', async () => {
    const walletDoc = {
      _id: '64f0c2a1b4e1c2d3e4f50900',
      userId: '507f1f77bcf86cd799439011',
      balance: 100,
      points: 150,
      currency: 'INR',
    };
    const walletRepository = {
      getOrCreateForUser: jest.fn().mockResolvedValue({ ...walletDoc, points: 50 }),
      atomicAddPoints: jest.fn().mockResolvedValue(walletDoc),
    };
    const transactionRepository = {
      createTransaction: jest.fn().mockImplementation(async (data) => ({
        _id: '64f0c2a1b4e1c2d3e4f50902',
        ...data,
      })),
    };

    const service = new WalletService(walletRepository, transactionRepository, null);

    const result = await service.addPoints('507f1f77bcf86cd799439011', {
      points: 100,
      description: 'Test points',
    });

    expect(walletRepository.atomicAddPoints).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 100, null);
    expect(result.wallet.points).toBe(150);
  });

  it('rejects points deduction when points balance is insufficient', async () => {
    const walletDoc = {
      _id: '64f0c2a1b4e1c2d3e4f50900',
      userId: '507f1f77bcf86cd799439011',
      points: 30,
    };
    const walletRepository = {
      getOrCreateForUser: jest.fn().mockResolvedValue(walletDoc),
    };

    const service = new WalletService(walletRepository, {}, null);

    await expect(
      service.deductPoints('507f1f77bcf86cd799439011', { points: 100 }),
    ).rejects.toMatchObject({
      code: ErrorCodes.WALLET_INSUFFICIENT_POINTS,
    });
  });
});
