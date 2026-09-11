function roundToTwo(num) {
  return Math.round((Number(num) || 0) * 100) / 100;
}

export class PricingEngine {
  static calculateBill({
    items = [],
    hygieneKit = {},
    membership = {},
    coupon = {},
    points = {},
    cashback = {},
    config = {},
  }) {
    let itemsSubtotal = 0;
    let itemsMrpTotal = 0;
    let maxItemHomeVisitFee = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const qty = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Number(item.snapshot?.unitPrice || 0);
      const extraCharge = Number(item.snapshot?.extraCharge || 0);
      const mrp = Number(item.snapshot?.mrp) || unitPrice;
      const visitFee = Number(item.snapshot?.homeVisitFee || 0);

      itemsSubtotal += (unitPrice + extraCharge) * qty;
      itemsMrpTotal += (Math.max(mrp, unitPrice) + extraCharge) * qty;
      if (visitFee > maxItemHomeVisitFee) {
        maxItemHomeVisitFee = visitFee;
      }
    }

    itemsSubtotal = roundToTwo(itemsSubtotal);
    itemsMrpTotal = roundToTwo(itemsMrpTotal);

    const kitCount = Math.max(1, Number(hygieneKit.count || 1));
    const kitUnitPrice = Number(hygieneKit.unitPrice ?? 49);
    const hygieneKitTotal = roundToTwo(kitCount * kitUnitPrice);

    const grossSubtotal = roundToTwo(itemsSubtotal + hygieneKitTotal);
    let payable = grossSubtotal;

    let membershipDiscount = 0;
    let membershipFee = 0;

    if (membership.isMember && membership.membershipPlan?.discountPercentage > 0) {
      const discountPct = Number(membership.membershipPlan.discountPercentage);
      membershipDiscount = roundToTwo((itemsSubtotal * discountPct) / 100);
      payable = Math.max(0, payable - membershipDiscount);
    } else if (membership.optInMembership && membership.membershipPlan?.price > 0) {
      membershipFee = roundToTwo(membership.membershipPlan.price);
      payable += membershipFee;
    }

    let couponDiscount = 0;
    let pointsDeducted = 0;
    let pointsValueDeducted = 0;
    let cashbackDeducted = 0;

    const couponObj = coupon.coupon;
    if (couponObj && payable > 0) {
      const minOrder = Number(couponObj.minOrderValue || 0);
      if (grossSubtotal >= minOrder) {
        if (couponObj.discountType === 'FLAT') {
          couponDiscount = Number(couponObj.discountValue || 0);
        } else {
          couponDiscount = (itemsSubtotal * Number(couponObj.discountValue || 0)) / 100;
          if (couponObj.maxDiscountAmount != null) {
            couponDiscount = Math.min(couponDiscount, Number(couponObj.maxDiscountAmount));
          }
        }
        couponDiscount = roundToTwo(Math.min(couponDiscount, payable));
        payable = Math.max(0, payable - couponDiscount);
      }
    } else if (coupon.couponDiscount && Number(coupon.couponDiscount) > 0 && payable > 0) {
      couponDiscount = roundToTwo(Math.min(Number(coupon.couponDiscount), payable));
      payable = Math.max(0, payable - couponDiscount);
    } else if (points.usePoints && Number(points.pointsBalance) > 0 && payable > 0) {
      const minPts = Number(points.minPointsToRedeem || 0);
      const userPts = Number(points.pointsBalance);
      if (userPts >= minPts) {
        const redeemRatio = Number(points.pointsRedeemRatio ?? 0.10);
        const maxRedeemPct = Number(points.maxPointsRedeemPercentage ?? 50);
        const maxAllowedCash = (payable * maxRedeemPct) / 100;
        const availableCash = userPts * redeemRatio;

        pointsValueDeducted = roundToTwo(Math.min(availableCash, payable, maxAllowedCash));
        pointsDeducted = Math.ceil(pointsValueDeducted / redeemRatio);
        payable = Math.max(0, payable - pointsValueDeducted);
      }
    } else if (cashback.useCashback && Number(cashback.cashbackBalance) > 0 && payable > 0) {
      cashbackDeducted = roundToTwo(Math.min(Number(cashback.cashbackBalance), payable));
      payable = Math.max(0, payable - cashbackDeducted);
    }

    const visitFeeThreshold = Number(config.visitFeeThreshold ?? 999);
    let visitFee = 0;
    if (grossSubtotal < visitFeeThreshold && maxItemHomeVisitFee > 0) {
      visitFee = roundToTwo(maxItemHomeVisitFee);
      payable += visitFee;
    }

    const taxRate = Number(config.taxRatePercentage || 0);
    const taxAmount = taxRate > 0 ? roundToTwo((payable * taxRate) / 100) : 0;
    const grandTotal = roundToTwo(Math.max(0, payable + taxAmount));

    const earnRatio = Number(points.pointsEarnRatio ?? 0.10);
    const earnPoints = Math.floor(grandTotal * earnRatio);

    const totalSavings = roundToTwo(
      Math.max(0, itemsMrpTotal - itemsSubtotal + couponDiscount + pointsValueDeducted + cashbackDeducted + membershipDiscount),
    );

    return {
      itemsSubtotal,
      itemsMrpTotal,
      hygieneKitTotal,
      hygieneKitCount: kitCount,
      hygieneKitUnitPrice: kitUnitPrice,
      subtotal: grossSubtotal,
      membershipDiscount,
      membershipFee,
      couponDiscount,
      couponCode: couponObj?.code || null,
      pointsDeducted,
      pointsValueDeducted,
      cashbackDeducted,
      visitFee,
      isVisitFeeWaived: visitFee === 0 && grossSubtotal >= visitFeeThreshold,
      taxAmount,
      grandTotal,
      earnPoints,
      totalSavings,
      currency: config.currency || 'INR',
      computedAt: new Date(),
    };
  }
}
