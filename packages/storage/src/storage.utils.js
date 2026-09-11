import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_DOCUMENT_MIME_TYPES,
  STORAGE_LIMITS,
} from './storage.constants.js';

const EXTENSION_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
};

/**
 * Derives safe file extension from MIME type or original filename.
 */
export function getFileExtension(mimeType, originalFilename = '') {
  if (mimeType && EXTENSION_BY_MIME[mimeType.toLowerCase()]) {
    return EXTENSION_BY_MIME[mimeType.toLowerCase()];
  }
  if (originalFilename) {
    const ext = path.extname(originalFilename).replace('.', '').toLowerCase();
    if (ext) return ext;
  }
  return 'bin';
}

/**
 * Builds a standardized entity object key using UUID for safe, conflict-free naming.
 *
 * Example:
 * buildObjectKey('users/{id}/profile', { id: 'GRUSR001' }, 'image/webp')
 * => "users/GRUSR001/profile/e4b1a8d0-...webp"
 */
export function buildObjectKey(template, params = {}, mimeType = 'image/jpeg', originalFilename = '') {
  let folder = template;
  for (const [key, value] of Object.entries(params)) {
    folder = folder.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value || 'default'));
  }

  const ext = getFileExtension(mimeType, originalFilename);
  const fileId = uuidv4();
  return `${folder.replace(/\/+/g, '/').replace(/^\//, '')}/${fileId}.${ext}`;
}

/**
 * Validates image upload metadata (MIME type and size).
 */
export function validateImageUpload(mimeType, sizeBytes = 0) {
  if (!mimeType || !ALLOWED_IMAGE_MIME_TYPES.has(mimeType.toLowerCase())) {
    throw new Error(`Invalid image type: "${mimeType}". Allowed: ${Array.from(ALLOWED_IMAGE_MIME_TYPES).join(', ')}`);
  }
  if (sizeBytes > STORAGE_LIMITS.MAX_IMAGE_SIZE_BYTES) {
    throw new Error(
      `Image size exceeds maximum limit of ${(STORAGE_LIMITS.MAX_IMAGE_SIZE_BYTES / (1024 * 1024)).toFixed(0)}MB`,
    );
  }
}

/**
 * Validates document upload metadata (MIME type and size).
 */
export function validateDocumentUpload(mimeType, sizeBytes = 0) {
  if (!mimeType || !ALLOWED_DOCUMENT_MIME_TYPES.has(mimeType.toLowerCase())) {
    throw new Error(`Invalid document type: "${mimeType}". Allowed: ${Array.from(ALLOWED_DOCUMENT_MIME_TYPES).join(', ')}`);
  }
  if (sizeBytes > STORAGE_LIMITS.MAX_DOCUMENT_SIZE_BYTES) {
    throw new Error(
      `Document size exceeds maximum limit of ${(STORAGE_LIMITS.MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024)).toFixed(0)}MB`,
    );
  }
}

/**
 * Extracts storage key from a full DigitalOcean Spaces / S3 URL if possible.
 */
export function extractKeyFromUrl(urlOrKey, bucketName = '') {
  if (!urlOrKey || typeof urlOrKey !== 'string') return null;
  if (!urlOrKey.startsWith('http://') && !urlOrKey.startsWith('https://')) {
    return urlOrKey;
  }

  try {
    const parsed = new URL(urlOrKey);
    let pathname = decodeURIComponent(parsed.pathname).replace(/^\//, '');

    // If path starts with bucket name (path-style), strip it
    if (bucketName && pathname.startsWith(`${bucketName}/`)) {
      pathname = pathname.substring(bucketName.length + 1);
    }
    return pathname;
  } catch {
    return urlOrKey;
  }
}
