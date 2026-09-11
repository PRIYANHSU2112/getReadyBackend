import { getOrCreateBookingSettings } from '../models/booking-settings.model.js';

export class PricingEngine {
  /**
   * Determine whether an eligible upgrade exists for a service
   * Rule: Same category, upgradePrice - selectedPrice between [minUpgradeDiff, maxUpgradeDiff]
   */
  static findEligibleUpgrade(selectedService, catalogServices = [], settings) {
    if (!settings.serviceUpgradeEnabled || !selectedService) return null;

    const basePrice = Number(selectedService.price || selectedService.unitPrice || 0);
    const categoryId = selectedService.categoryId?.toString?.() || selectedService.categoryId;

    const minDiff = Number(settings.minUpgradeDifference ?? 100);
    const maxDiff = Number(settings.maxUpgradeDifference ?? 200);

    // Look for matching service in same category with higher price within threshold
    const candidates = catalogServices.filter((svc) => {
      const svcId = svc.id || svc._id?.toString?.();
      const selId = selectedService.id || selectedService._id?.toString?.() || selectedService.serviceId;
      if (svcId === selId) return false;

      const svcCatId = svc.categoryId?.toString?.() || svc.categoryId;
      if (categoryId && svcCatId && svcCatId !== categoryId) return false;

      const candidatePrice = Number(svc.price || svc.discountedPrice || 0);
      const diff = candidatePrice - basePrice;
      return diff >= minDiff && diff <= maxDiff;
    });

    if (candidates.length === 0) return null;

    // Pick closest/best candidate
    const best = candidates[0];
    const upgradePrice = Number(best.price || best.discountedPrice || 0);
    const diff = upgradePrice - basePrice;

    return {
      upgradeServiceId: best.id || best._id?.toString(),
      upgradeServiceName: best.name,
      basePrice,
      upgradePrice,
      priceDifference: diff,
      recommended: true,
      message: `Upgrade to ${best.name} for only ₹${diff} more!`,
    };
  }

  /**
   * Authoritative calculation for Preview & Final Confirmation
   */
  static async calculate({
    items = [],
    hygieneKitQuantity = 1,
    membershipOptIn = false,
    userHasMembership = false,
    couponCode = null,
    useWallet = false,
    walletBalance = 0,
    usePoints = false,
    pointsBalance = 0,
    useCashback = false,
    cashbackBalance = 0,
    catalogServices = [],
    settingsOverride = null,
  }) {
    const settings = settingsOverride || (await getOrCreateBookingSettings());

    let servicesSubtotal = 0;
    let upgradesTotal = 0;
    const computedItems = [];

    // 1. Process items and calculate item subtotals
    for (const item of items) {
      const quantity = Math.max(1, Number(item.quantity || 1));
      const basePrice = Number(item.basePrice ?? item.unitPrice ?? item.price ?? 0);
      let upgradePriceDiff = 0;
      let upgradeServiceId = null;
      let upgradeServiceName = null;

      // Check if upgrade was explicitly selected
      if (item.upgradeSelected && item.upgradeServiceId) {
        upgradeServiceId = item.upgradeServiceId;
        upgradeServiceName = item.upgradeServiceName || 'Service Upgrade';
        upgradePriceDiff = Math.max(0, Number(item.upgradePriceDifference || 0));
        upgradesTotal += upgradePriceDiff * quantity;
      }

      const unitPrice = basePrice + upgradePriceDiff;
      const totalPrice = unitPrice * quantity;
      servicesSubtotal += basePrice * quantity;

      // Find available upgrade recommendation for preview
      const upgradeOffer = PricingEngine.findEligibleUpgrade(
        { ...item, price: basePrice, unitPrice: basePrice },
        catalogServices,
        settings,
      );

      computedItems.push({
        ...item,
        quantity,
        basePrice,
        upgradeServiceId,
        upgradeServiceName,
        upgradePriceDifference: upgradePriceDiff,
        unitPrice,
        totalPrice,
        upgradeOffer,
      });
    }

    const itemsSubtotal = servicesSubtotal + upgradesTotal;

    // 2. Hygiene Kit (Mandatory, added once per booking, min qty 1)
    const sanitizedKitQty = Math.max(
      settings.hygieneKitDefaultQuantity || 1,
      Number(hygieneKitQuantity || 1),
    );
    const hygieneKitUnitPrice = Number(settings.hygieneKitPrice ?? 49);
    const hygieneKitTotal = sanitizedKitQty * hygieneKitUnitPrice;

    const subtotal = itemsSubtotal + hygieneKitTotal;

    // 3. Membership Discount (e.g., 10% discount for members on services)
    let membershipDiscount = 0;
    const isMember = Boolean(userHasMembership || membershipOptIn);
    if (isMember) {
      membershipDiscount = Math.round(itemsSubtotal * 0.1); // 10% member saving
    }

    // 4. Coupon Calculation
    let couponDiscount = 0;
    let appliedCoupon = null;
    if (couponCode && settings.couponEnabled) {
      const code = couponCode.trim().toUpperCase();
      // Example standard coupons: FLAT300, GETREADY100, FIRST50
      if (code === 'FLAT300' && subtotal >= 999) {
        couponDiscount = 300;
        appliedCoupon = { code: 'FLAT300', discount: 300, message: '₹300 flat discount applied' };
      } else if (code === 'GETREADY100' && subtotal >= 499) {
        couponDiscount = 100;
        appliedCoupon = { code: 'GETREADY100', discount: 100, message: '₹100 discount applied' };
      } else if (code === 'BEAUTY20') {
        couponDiscount = Math.min(400, Math.round(itemsSubtotal * 0.2));
        appliedCoupon = { code: 'BEAUTY20', discount: couponDiscount, message: '20% off applied' };
      } else {
        // Generic fallback demo coupon
        couponDiscount = Math.min(200, Math.round(itemsSubtotal * 0.1));
        appliedCoupon = { code, discount: couponDiscount, message: `Coupon ${code} applied` };
      }
    }

    // Ensure discounts do not exceed subtotal
    const totalDiscount = Math.min(subtotal, membershipDiscount + couponDiscount);
    const amountAfterDiscounts = Math.max(0, subtotal - totalDiscount);

    // 5. Wallet & Deductions
    let walletDeduction = 0;
    if (useWallet && walletBalance > 0) {
      walletDeduction = Math.min(amountAfterDiscounts, Number(walletBalance));
    }

    let pointsDeduction = 0;
    if (usePoints && pointsBalance > 0 && amountAfterDiscounts - walletDeduction > 0) {
      const remaining = amountAfterDiscounts - walletDeduction;
      pointsDeduction = Math.min(remaining, Math.floor(pointsBalance * 0.5)); // 1 pt = ₹0.50
    }

    let cashbackDeduction = 0;
    if (useCashback && cashbackBalance > 0 && amountAfterDiscounts - walletDeduction - pointsDeduction > 0) {
      const remaining = amountAfterDiscounts - walletDeduction - pointsDeduction;
      cashbackDeduction = Math.min(remaining, Number(cashbackBalance));
    }

    const totalDeductions = walletDeduction + pointsDeduction + cashbackDeduction;
    const payableAmount = Math.max(0, amountAfterDiscounts - totalDeductions);
    const totalSavings = totalDiscount + pointsDeduction + cashbackDeduction;

    // 6. Cashback & Points Earned (To be credited to Account Owner upon completion)
    const cashbackPct = Number(settings.cashbackPercentage ?? 10);
    const pointsPct = Number(settings.pointsPercentage ?? 10);
    const cashbackEarned = settings.cashbackEnabled
      ? Math.round((payableAmount + walletDeduction) * (cashbackPct / 100))
      : 0;
    const pointsEarned = settings.pointsEnabled
      ? Math.round((payableAmount + walletDeduction) * (pointsPct / 100))
      : 0;

    return {
      items: computedItems,
      hygieneKit: {
        mandatory: true,
        hygieneKitId: 'default-safety-kit',
        title: settings.hygieneKitTitle,
        description: settings.hygieneKitDescription,
        includedItems: settings.hygieneKitIncludedItems,
        unitPrice: hygieneKitUnitPrice,
        quantity: sanitizedKitQty,
        total: hygieneKitTotal,
      },
      pricing: {
        servicesSubtotal,
        upgradesTotal,
        itemsSubtotal,
        hygieneKitTotal,
        subtotal,
        membershipDiscount,
        couponDiscount,
        walletDeduction,
        pointsDeduction,
        cashbackDeduction,
        tax: 0,
        totalSavings,
        payableAmount,
        cashbackEarned,
        pointsEarned,
      },
      appliedCoupon,
      rewards: {
        cashback: cashbackEarned,
        points: pointsEarned,
        creditAfterCompletion: true,
        message: 'Cashback & points will be credited to your account after successful service completion.',
      },
    };
  }
}
