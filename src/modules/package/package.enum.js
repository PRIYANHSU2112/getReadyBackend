export const PackageType = Object.freeze({
  FIXED: 'FIXED',
  CUSTOMIZABLE: 'CUSTOMIZABLE',
});

export const PackageStatus = Object.freeze({
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

export const PackageChangeRequestStatus = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

export const PackageGender = Object.freeze({
  ALL: 'all',
  FEMALE: 'female',
  MALE: 'male',
  UNISEX: 'unisex',
});

export const PackageDiscountType = Object.freeze({
  NONE: 'NONE',
  PERCENTAGE: 'PERCENTAGE',
  FIXED: 'FIXED',
});

export const PackageBadge = Object.freeze({
  MOST_POPULAR: 'most_popular',
  TRENDING: 'trending',
  TOP_RATED: 'top_rated',
  BEST_SELLER: 'best_seller',
  SPECIAL_OFFER: 'special_offer',
});
