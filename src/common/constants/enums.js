/**
 * All application enums live in this file (no scattered enum modules).
 */
export const UserRole = Object.freeze({
  ADMIN: 'admin',
  USER: 'user',
});

export const StorageProvider = Object.freeze({
  LOCAL: 'local',
  S3: 's3',
  CLOUDINARY: 'cloudinary',
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
