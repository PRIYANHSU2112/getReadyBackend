export function toWalletDto(wallet) {
  if (!wallet) return null;
  const raw = typeof wallet.toObject === 'function' ? wallet.toObject() : wallet;
  return {
    id: raw._id?.toString() || raw.id,
    userId: raw.userId?.toString() || raw.userId,
    balance: Number(raw.balance || 0),
    points: Number(raw.points || 0),
    cashbackBalance: Number(raw.cashbackBalance || 0),
    totalCashbackEarned: Number(raw.totalCashbackEarned || 0),
    totalPointsEarned: Number(raw.totalPointsEarned || 0),
    isActive: Boolean(raw.isActive),
    currency: raw.currency || 'INR',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export function toWalletTransactionDto(transaction) {
  if (!transaction) return null;
  const raw = typeof transaction.toObject === 'function' ? transaction.toObject() : transaction;
  return {
    id: raw._id?.toString() || raw.id,
    walletId: raw.walletId?.toString() || raw.walletId,
    userId: raw.userId?.toString() || raw.userId,
    type: raw.type,
    category: raw.category,
    amount: Number(raw.amount || 0),
    points: Number(raw.points || 0),
    balanceAfter: Number(raw.balanceAfter || 0),
    pointsBalanceAfter: Number(raw.pointsBalanceAfter || 0),
    status: raw.status,
    referenceId: raw.referenceId || null,
    description: raw.description || null,
    metadata: raw.metadata || {},
    createdAt: raw.createdAt,
  };
}

export function toLoyaltyRuleDto(rule) {
  if (!rule) return null;
  const raw = typeof rule.toObject === 'function' ? rule.toObject() : rule;
  return {
    id: raw._id?.toString() || raw.id,
    earnRatio: Number(raw.earnRatio || 0.1),
    redeemRatio: Number(raw.redeemRatio || 0.1),
    minPointsToRedeem: Number(raw.minPointsToRedeem || 100),
    maxRedeemPercentage: Number(raw.maxRedeemPercentage || 50),
    isActive: Boolean(raw.isActive),
    updatedAt: raw.updatedAt,
  };
}
