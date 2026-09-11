/**
 * Central storage constants, entity folder paths, and file validation schemas.
 */

export const STORAGE_FOLDERS = {
  // Users & Customers
  USER_PROFILE: 'users/{id}/profile',
  USER_DOCUMENTS: 'users/{id}/documents/{docType}',

  // Beauticians & Staff
  BEAUTICIAN_PROFILE: 'beauticians/{id}/profile',
  BEAUTICIAN_DOCUMENTS: 'beauticians/{id}/documents/{docType}',
  BEAUTICIAN_CERTIFICATES: 'beauticians/{id}/certificates',
  BEAUTICIAN_BANK: 'beauticians/{id}/bank',
  BEAUTICIAN_SELFIE: 'beauticians/{id}/selfie',

  // Catalog & Inventory
  SERVICE_COVER: 'services/{id}/cover',
  SERVICE_GALLERY: 'services/{id}/gallery',
  CATEGORY_COVER: 'categories/{id}/cover',
  PACKAGE_COVER: 'packages/{id}/cover',
  HYGIENE_KIT: 'hygiene-kit/{id}',
  FILTERS: 'filters/{id}',

  // Marketing, Content & Engagement
  BANNER: 'banners/{id}',
  BLOG: 'blogs/{id}',
  CMS: 'cms/{id}',
  COUPONS: 'coupons/{id}',
  REVIEWS: 'reviews/{id}',

  // Async Jobs & Exports
  EXPORTS: 'exports/{id}',
};

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

export const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

export const STORAGE_LIMITS = {
  MAX_IMAGE_SIZE_BYTES: 15 * 1024 * 1024, // 15 MB
  MAX_DOCUMENT_SIZE_BYTES: 25 * 1024 * 1024, // 25 MB
  DEFAULT_PRESIGNED_EXPIRES_SECONDS: 900, // 15 minutes
  DEFAULT_SIGNED_DOWNLOAD_EXPIRES_SECONDS: 3600, // 1 hour
};
