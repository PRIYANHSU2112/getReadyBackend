function idOf(val) {
  if (val == null) return null;
  if (typeof val === 'string') return val;
  if (val.toString) return val.toString();
  return val;
}

export function toWalletTransactionDto(tx) {
  const raw = typeof tx?.toObject === 'function' ? tx.toObject() : tx;
  return {
    id: idOf(raw?._id || raw?.id),
    walletId: idOf(raw?.walletId),
    userId: idOf(raw?.userId),
    type: raw?.type,
    category: raw?.category,
    status: raw?.status,
    amount: raw?.amount ?? 0,
    points: raw?.points ?? 0,
    balanceAfter: raw?.balanceAfter ?? 0,
    pointsAfter: raw?.pointsAfter ?? 0,
    paymentGateway: raw?.paymentGateway || 'SYSTEM',
    razorpayOrderId: raw?.razorpayOrderId ?? null,
    razorpayPaymentId: raw?.razorpayPaymentId ?? null,
    description: raw?.description ?? null,
    referenceId: raw?.referenceId ?? null,
    createdAt: raw?.createdAt ?? null,
  };
}

export function toWalletDto(wallet) {
  const raw = typeof wallet?.toObject === 'function' ? wallet.toObject() : wallet;
  return {
    id: idOf(raw?._id || raw?.id),
    userId: idOf(raw?.userId),
    balance: raw?.balance ?? 0,
    points: raw?.points ?? 0,
    cashbackBalance: raw?.cashbackBalance ?? 0,
    currency: raw?.currency || 'INR',
    isActive: raw?.isActive ?? true,
    createdAt: raw?.createdAt ?? null,
    updatedAt: raw?.updatedAt ?? null,
  };
}
