import { CART_CURRENCY } from '../../common/constants/cart.js';

function idOf(value) {
  if (value == null) return value;
  if (typeof value === 'string') return value;
  if (value.toString) return value.toString();
  return value;
}

function mapSelectedService(row) {
  return {
    serviceId: idOf(row.serviceId),
    name: row.name,
    durationMin: row.durationMin ?? null,
  };
}

function mapForMember(item) {
  const memberId = item.forMemberId ? idOf(item.forMemberId) : null;
  if (!memberId && !item.forMemberSnapshot) {
    return null;
  }
  return {
    id: memberId,
    name: item.forMemberSnapshot?.name || 'Member',
    relationship: item.forMemberSnapshot?.relationship ?? null,
    avatarUrl: item.forMemberSnapshot?.avatarUrl ?? null,
    phone: item.forMemberSnapshot?.phone ?? null,
  };
}

function mapCartItem(item) {
  const lineId = idOf(item._id || item.id);
  return {
    id: lineId,
    itemType: item.itemType,
    refId: idOf(item.refId),
    quantity: item.quantity,
    forMemberId: item.forMemberId ? idOf(item.forMemberId) : null,
    forMember: mapForMember(item),
    snapshot: {
      name: item.snapshot?.name,
      thumbnail: item.snapshot?.thumbnail ?? null,
      durationLabel: item.snapshot?.durationLabel ?? null,
      badges: item.snapshot?.badges || [],
      unitPrice: item.snapshot?.unitPrice ?? 0,
      mrp: item.snapshot?.mrp ?? null,
      rating: item.snapshot?.rating ?? null,
      homeVisitFee: item.snapshot?.homeVisitFee ?? 0,
      extraCharge: item.snapshot?.extraCharge ?? 0,
    },
    packageMeta: item.packageMeta
      ? {
          subtitle: item.packageMeta.subtitle ?? null,
          selectionRule: item.packageMeta.selectionRule
            ? {
                minSelect: item.packageMeta.selectionRule.minSelect ?? null,
                maxSelect: item.packageMeta.selectionRule.maxSelect ?? null,
              }
            : null,
        }
      : null,
    selectedServices: (item.selectedServices || []).map(mapSelectedService),
    lineTotal:
      ((Number(item.snapshot?.unitPrice) || 0) + (Number(item.snapshot?.extraCharge) || 0)) *
      (Number(item.quantity) || 0),
  };
}

function buildRecipients(items) {
  const map = new Map();

  for (const item of items) {
    const key = item.forMemberId || 'self';
    if (!map.has(key)) {
      map.set(key, {
        memberId: item.forMemberId || null,
        name: item.forMemberId ? item.forMember?.name || 'Member' : 'Self',
        relationship: item.forMember?.relationship ?? null,
        avatarUrl: item.forMember?.avatarUrl ?? null,
        itemCount: 0,
        lineIds: [],
      });
    }
    const row = map.get(key);
    row.itemCount += item.quantity || 0;
    row.lineIds.push(item.id);
  }

  // Self first, then others by name
  const recipients = [...map.values()];
  recipients.sort((a, b) => {
    if (a.memberId == null && b.memberId != null) return -1;
    if (a.memberId != null && b.memberId == null) return 1;
    return String(a.name).localeCompare(String(b.name));
  });
  return recipients;
}

function mapHygieneKit(kit, kitMeta = null) {
  if (!kit) return null;
  const kitId = idOf(kit.hygieneKitId || kit._id || kit.id);
  const count = Number(kit.count ?? kit.quantity) || 1;
  const unitPrice = Number(kitMeta?.price ?? kit.unitPrice ?? 49);
  return {
    hygieneKitId: kitId,
    title: kitMeta?.title || kit.title || 'Standard Safety & Hygiene Kit',
    count,
    quantity: count,
    unitPrice,
    totalPrice: count * unitPrice,
    isRequired: kitMeta?.isRequired !== undefined ? kitMeta.isRequired : (kit.isRequired !== false),
    isDefault: kitMeta?.isDefault !== undefined ? kitMeta.isDefault : true,
  };
}



function mapBenefits(benefits = {}, extras = {}) {
  return {
    couponCode: benefits.couponCode || null,
    usePoints: Boolean(benefits.usePoints || benefits.useCredits),
    useCashback: Boolean(benefits.useCashback),
    membershipOptIn: Boolean(benefits.membershipOptIn),
    pointsBalance: extras.pointsBalance ?? extras.creditsBalance ?? 0,
    cashbackBalance: extras.cashbackBalance ?? 0,
  };
}

function mapPricing(pricing) {
  if (!pricing) {
    return {
      itemsSubtotal: 0,
      hygieneKitTotal: 0,
      subtotal: 0,
      visitFee: 0,
      visitFeeWaived: false,
      couponDiscount: 0,
      pointsDeduction: 0,
      cashbackDeduction: 0,
      grandTotal: 0,
      savings: 0,
      earnPoints: 0,
      upsell: null,
      currency: CART_CURRENCY,
      computedAt: null,
    };
  }

  return {
    itemsSubtotal: pricing.itemsSubtotal ?? pricing.subtotal ?? 0,
    hygieneKitTotal: pricing.hygieneKitTotal ?? 0,
    subtotal: pricing.subtotal ?? 0,
    visitFee: pricing.visitFee ?? 0,
    visitFeeWaived: Boolean(pricing.visitFeeWaived),
    couponDiscount: pricing.couponDiscount ?? 0,
    pointsDeduction: pricing.pointsDeduction ?? pricing.creditsDeduction ?? 0,
    cashbackDeduction: pricing.cashbackDeduction ?? 0,
    grandTotal: pricing.grandTotal ?? 0,
    savings: pricing.savings ?? 0,
    earnPoints: pricing.earnPoints ?? 0,
    upsell: pricing.upsell
      ? {
          amountToWaiveVisitFee: pricing.upsell.amountToWaiveVisitFee ?? 0,
          message: pricing.upsell.message ?? null,
        }
      : null,
    currency: pricing.currency || CART_CURRENCY,
    computedAt: pricing.computedAt || null,
  };
}

/**
 * @param {object} cart - lean or document
 * @param {{ pointsBalance?: number, cashbackBalance?: number }} [extras]
 */
export function toCartDto(cart, extras = {}) {
  const raw = typeof cart?.toObject === 'function' ? cart.toObject() : cart;
  const items = (raw?.items || []).map(mapCartItem);

  return {
    id: idOf(raw?._id || raw?.id),
    userId: idOf(raw?.userId),
    items,
    hygieneKit: mapHygieneKit(raw?.hygieneKit, extras.hygieneKitMeta),
    itemCount: items.reduce((sum, item) => sum + (item.quantity || 0), 0),
    recipients: buildRecipients(items),
    specialInstructions: raw?.specialInstructions ?? null,
    benefits: mapBenefits(raw?.benefits, extras),
    pricing: mapPricing(raw?.pricing),
    expiresAt: raw?.expiresAt ?? null,
    checkedOutAt: raw?.checkedOutAt ?? null,
    createdAt: raw?.createdAt ?? null,
    updatedAt: raw?.updatedAt ?? null,
  };
}


