/**
 * All application enums live in this file (no scattered enum modules).
 */
export const UserRole = Object.freeze({
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
  CUSTOMER: 'customer',
  BEAUTICIAN: 'beautician',
});

export const Gender = Object.freeze({
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  OTHER: 'OTHER',
});

export const OtpPurpose = Object.freeze({
  LOGIN: 'login',
  RESET_PASSWORD: 'reset_password',
});

export const AuthChannel = Object.freeze({
  MOBILE: 'mobile',
  ADMIN: 'admin',
});

export const StorageProvider = Object.freeze({
  LOCAL: 'local',
  S3: 's3',
});

export const NodeEnv = Object.freeze({
  DEVELOPMENT: 'development',
  TEST: 'test',
  STAGING: 'staging',
  PRODUCTION: 'production',
});

export const EventType = Object.freeze({
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
});

export const AddressLabel = Object.freeze({
  HOME: 'HOME',
  WORK: 'WORK',
  OFFICE: 'OFFICE',
  OTHER: 'OTHER',
});

export const BannerType = Object.freeze({
  PROMOTION: 'PROMOTION',
  ANNOUNCEMENT: 'ANNOUNCEMENT',
  OFFER: 'OFFER',
  GENERAL: 'GENERAL',
});

export const BannerStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
});

export const BannerPlatform = Object.freeze({
  ALL: 'ALL',
  ANDROID: 'ANDROID',
  IOS: 'IOS',
  WEB: 'WEB',
});

export const FilterDisplayType = Object.freeze({
  CHIPS: 'chips',
  CHECKBOX: 'checkbox',
  RADIO: 'radio',
  DROPDOWN: 'dropdown',
  RANGE: 'range',
});

export const FilterSelectionType = Object.freeze({
  SINGLE: 'single',
  MULTIPLE: 'multiple',
});

export const ServiceDiscountType = Object.freeze({
  NONE: 'NONE',
  PERCENTAGE: 'PERCENTAGE',
  FIXED: 'FIXED',
});

export const ServiceStatus = Object.freeze({
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

export const ServiceChangeRequestStatus = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

export const ServiceBadge = Object.freeze({
  MOST_POPULAR: 'most_popular',
  TRENDING: 'trending',
  TOP_RATED: 'top_rated',
});

export const ServiceGender = Object.freeze({
  ALL: 'all',
  FEMALE: 'female',
  MALE: 'male',
  UNISEX: 'unisex',
});

export const BeauticianProfileStatus = Object.freeze({
  PENDING: 'PENDING',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED',
});

export const KycStatus = Object.freeze({
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
});

export const BankVerificationStatus = Object.freeze({
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
});

export const CertificateStatus = Object.freeze({
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
});

export const CartItemType = Object.freeze({
  SERVICE: 'SERVICE',
  PACKAGE: 'PACKAGE',
});

export const MemberRelationship = Object.freeze({
  SISTER: 'SISTER',
  MOTHER: 'MOTHER',
  FATHER: 'FATHER',
  BROTHER: 'BROTHER',
  SPOUSE: 'SPOUSE',
  CHILD: 'CHILD',
  FRIEND: 'FRIEND',
  OTHER: 'OTHER',
});

export const MemberSkinType = Object.freeze({
  OILY: 'OILY',
  DRY: 'DRY',
  SENSITIVE: 'SENSITIVE',
  COMBINATION: 'COMBINATION',
});

export const BookForOthersMode = Object.freeze({
  SAME_SERVICES: 'SAME_SERVICES',
});

export const SlotStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  BLOCKED: 'BLOCKED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
});

export const SlotAvailability = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  FULL: 'FULL',
});

export const BlogStatus = Object.freeze({
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
});

export const HygieneKitStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
});

