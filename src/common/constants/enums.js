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
