import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { WalletService } from '../../services/wallet-service/src/services/wallet.service.js';
import { WalletTransactionCategory, WalletTransactionType } from '../../services/wallet-service/src/models/wallet.enum.js';

describe('Wallet Service Test Suite', () => {
  let walletRepo;
  let txnRepo;
  let loyaltyRepo;
  let publisher;
  let walletService;

  beforeEach(() => {
    const mockWallet = {
      _id: '65fc8e129182a1048b111001',
      userId: '65fc8e129182a1048b111002',
      balance: 500,
      points: 200,
      cashbackBalance: 0,
      save: jest.fn().mockResolvedValue(true),
    };

    walletRepo = {
      getOrCreateForUser: jest.fn().mockResolvedValue(mockWallet),
      findByUserId: jest.fn().mockResolvedValue(mockWallet),
      save: jest.fn().mockResolvedValue(mockWallet),
    };

    txnRepo = {
      create: jest.fn().mockImplementation((data) => ({
        _id: '65fc8e129182a1048b111999',
        ...data,
      })),
      listByUser: jest.fn().mockResolvedValue({ transactions: [], total: 0 }),
    };

    loyaltyRepo = {
      findRule: jest.fn().mockResolvedValue({
        earnRatio: 0.1,
        redeemRatio: 0.1,
        minPointsToRedeem: 100,
        maxRedeemPercentage: 50,
        isActive: true,
      }),
    };

    publisher = {
      publishDomainEvent: jest.fn().mockResolvedValue(true),
    };

    walletService = new WalletService(walletRepo, txnRepo, loyaltyRepo, publisher);
  });

  it('should credit wallet atomically and publish domain event', async () => {
    const res = await walletService.creditWallet(
      '65fc8e129182a1048b111002',
      200,
      WalletTransactionCategory.ADMIN_ADJUSTMENT,
      'ref_123',
      'Test credit',
    );

    expect(res.wallet.balance).toBe(700);
    expect(txnRepo.create).toHaveBeenCalled();
    expect(publisher.publishDomainEvent).toHaveBeenCalledWith(
      'WalletCredited',
      expect.objectContaining({ amount: 200, balance: 700 }),
      expect.any(Object),
    );
  });

  it('should debit wallet when balance is sufficient', async () => {
    const res = await walletService.debitWallet(
      '65fc8e129182a1048b111002',
      300,
      WalletTransactionCategory.BOOKING_PAYMENT,
      'book_123',
    );

    expect(res.wallet.balance).toBe(200);
    expect(publisher.publishDomainEvent).toHaveBeenCalledWith(
      'WalletDebited',
      expect.objectContaining({ amount: 300, balance: 200 }),
      expect.any(Object),
    );
  });

  it('should reject debit when balance is insufficient', async () => {
    await expect(
      walletService.debitWallet(
        '65fc8e129182a1048b111002',
        1000,
        WalletTransactionCategory.BOOKING_PAYMENT,
      ),
    ).rejects.toThrow('Insufficient wallet balance');
  });
});
