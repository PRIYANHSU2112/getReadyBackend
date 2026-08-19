export const WalletTransactionType = Object.freeze({
  CREDIT: 'CREDIT',
  DEBIT: 'DEBIT',
});

export const WalletTransactionCategory = Object.freeze({
  TOPUP: 'TOPUP',
  POINTS_EARNED: 'POINTS_EARNED',
  POINTS_REDEEMED: 'POINTS_REDEEMED',
  CASHBACK_CREDITED: 'CASHBACK_CREDITED',
  CASHBACK_REDEEMED: 'CASHBACK_REDEEMED',
  PAYMENT: 'PAYMENT',
  REFUND: 'REFUND',
});

export const WalletTransactionStatus = Object.freeze({
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
});
