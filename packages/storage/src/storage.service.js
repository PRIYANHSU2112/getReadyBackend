import {
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import { createS3Client } from './s3.client.js';
import { STORAGE_LIMITS } from './storage.constants.js';
import { extractKeyFromUrl, buildObjectKey } from './storage.utils.js';

export class StorageService {
  constructor(config = {}) {
    const { client, bucket, endpoint, region } = createS3Client(config);
    this.s3 = client;
    this.bucket = bucket;
    this.endpoint = endpoint.replace(/\/+$/, '');
    this.region = region;
  }

  /**
   * Generates public CDN / Spaces URL for an object key.
   * Format: https://<bucket>.<region>.digitaloceanspaces.com/<key>
   */
  getPublicUrl(key) {
    if (!key) return null;
    const cleanKey = key.replace(/^\/+/, '');

    // DigitalOcean spaces domain resolution
    if (this.endpoint.includes('digitaloceanspaces.com')) {
      const origin = this.endpoint.replace('https://', '').replace('http://', '');
      return `https://${this.bucket}.${origin}/${cleanKey}`;
    }

    // Linode Object Storage domain resolution
    if (this.endpoint.includes('linodeobjects.com')) {
      const origin = this.endpoint.replace('https://', '').replace('http://', '');
      return `https://${this.bucket}.${origin}/${cleanKey}`;
    }

    // AWS standard or custom endpoint
    if (this.endpoint.includes('amazonaws.com')) {
      return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${cleanKey}`;
    }

    return `${this.endpoint}/${this.bucket}/${cleanKey}`;
  }

  /**
   * Uploads raw buffer to Object Storage.
   *
   * @param {Object} params
   * @param {Buffer} params.buffer - File buffer
   * @param {string} params.key - Destination key in bucket
   * @param {string} params.contentType - MIME type
   * @param {boolean} [params.isPublic=true] - Public-read ACL or private
   * @param {Object} [params.metadata={}] - Custom object metadata
   * @returns {Promise<{ url: string|null, key: string, bucket: string, size: number, mimeType: string }>}
   */
  async uploadBuffer({ buffer, key, contentType = 'application/octet-stream', isPublic = true, metadata = {} }) {
    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new Error('StorageService.uploadBuffer: Invalid buffer provided.');
    }
    if (!key) {
      throw new Error('StorageService.uploadBuffer: Destination key is required.');
    }

    const cleanKey = key.replace(/^\/+/, '');
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: cleanKey,
      Body: buffer,
      ContentType: contentType,
      ACL: isPublic ? 'public-read' : 'private',
      Metadata: metadata,
    });

    try {
      await this.s3.send(command);
      return {
        key: cleanKey,
        url: isPublic ? this.getPublicUrl(cleanKey) : null,
        bucket: this.bucket,
        size: buffer.length,
        mimeType: contentType,
      };
    } catch (err) {
      throw new Error(`Failed to upload object to storage: ${err.message || 'Storage error'}`);
    }
  }

  /**
   * Convenience upload handler accepting a Multer file object.
   *
   * @param {Object} file - Multer file object
   * @param {string} [folder='uploads'] - Folder prefix or template
   * @param {boolean} [isPublic=true] - Public access
   * @returns {Promise<{ url: string|null, key: string, publicId: string }>}
   */
  async upload(file, folder = 'uploads', isPublic = true) {
    if (!file) return null;

    let buffer = file.buffer;
    if (!buffer && file.path && fs.existsSync(file.path)) {
      buffer = fs.readFileSync(file.path);
    }

    if (!buffer) {
      throw new Error('StorageService.upload: No file buffer or accessible path available.');
    }

    const mimeType = file.mimetype || 'image/jpeg';
    const key = buildObjectKey(folder, {}, mimeType, file.originalname || file.name || 'file.jpg');

    const result = await this.uploadBuffer({
      buffer,
      key,
      contentType: mimeType,
      isPublic,
    });

    return {
      url: result.url,
      key: result.key,
      publicId: result.key, // backwards compatibility with publicId
      size: result.size,
      mimeType: result.mimeType,
    };
  }

  /**
   * Uploads readable stream to Object Storage.
   */
  async uploadStream({ stream, key, contentType = 'application/octet-stream', isPublic = true, metadata = {} }) {
    if (!stream) {
      throw new Error('StorageService.uploadStream: Stream is required.');
    }
    if (!key) {
      throw new Error('StorageService.uploadStream: Destination key is required.');
    }

    const cleanKey = key.replace(/^\/+/, '');
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: cleanKey,
      Body: stream,
      ContentType: contentType,
      ACL: isPublic ? 'public-read' : 'private',
      Metadata: metadata,
    });

    try {
      await this.s3.send(command);
      return {
        key: cleanKey,
        url: isPublic ? this.getPublicUrl(cleanKey) : null,
        bucket: this.bucket,
        mimeType: contentType,
      };
    } catch (err) {
      throw new Error(`Failed to stream object to storage: ${err.message || 'Stream upload failure'}`);
    }
  }

  /**
   * Deletes an object by key or URL. Idempotent.
   */
  async deleteObject(urlOrKey) {
    const key = extractKeyFromUrl(urlOrKey, this.bucket);
    if (!key) return true;

    const cleanKey = key.replace(/^\/+/, '');
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: cleanKey,
    });

    try {
      await this.s3.send(command);
      return true;
    } catch (err) {
      console.warn(`[StorageService.deleteObject] Warning deleting key "${cleanKey}": ${err.message}`);
      return false;
    }
  }

  /**
   * Alias for deleteObject.
   */
  async delete(urlOrKey) {
    return this.deleteObject(urlOrKey);
  }

  /**
   * Safely replaces an old object with a new one:
   * 1. Uploads the new object first.
   * 2. If upload succeeds, deletes the old object.
   * 3. Never deletes the old object if the new upload fails.
   */
  async replaceObject({ oldUrlOrKey, buffer, key, contentType, isPublic = true, metadata = {} }) {
    const newUploadResult = await this.uploadBuffer({
      buffer,
      key,
      contentType,
      isPublic,
      metadata,
    });

    const oldKey = extractKeyFromUrl(oldUrlOrKey, this.bucket);
    if (oldKey && oldKey !== newUploadResult.key) {
      this.deleteObject(oldKey).catch((delErr) => {
        console.warn(`[StorageService.replaceObject] Failed to delete old key "${oldKey}": ${delErr.message}`);
      });
    }

    return newUploadResult;
  }

  /**
   * Convenience replace method for Multer file.
   */
  async replace(file, oldUrlOrKey, folder = 'uploads', isPublic = true) {
    const uploaded = await this.upload(file, folder, isPublic);
    if (uploaded && oldUrlOrKey) {
      const oldKey = extractKeyFromUrl(oldUrlOrKey, this.bucket);
      if (oldKey && oldKey !== uploaded.key) {
        this.deleteObject(oldKey).catch(() => {});
      }
    }
    return uploaded;
  }

  /**
   * Checks if an object exists in storage.
   */
  async exists(urlOrKey) {
    const key = extractKeyFromUrl(urlOrKey, this.bucket);
    if (!key) return false;

    const cleanKey = key.replace(/^\/+/, '');
    try {
      await this.s3.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: cleanKey,
        }),
      );
      return true;
    } catch (err) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return false;
      }
      return false;
    }
  }

  /**
   * Generates a temporary pre-signed download URL for sensitive/private assets (e.g., Aadhaar KYC, passbooks).
   */
  async getSignedDownloadUrl(urlOrKey, expiresInSeconds = STORAGE_LIMITS.DEFAULT_SIGNED_DOWNLOAD_EXPIRES_SECONDS) {
    const key = extractKeyFromUrl(urlOrKey, this.bucket);
    if (!key) return null;

    const cleanKey = key.replace(/^\/+/, '');
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: cleanKey,
    });

    try {
      return await getSignedUrl(this.s3, command, { expiresIn: expiresInSeconds });
    } catch (err) {
      throw new Error(`Failed to generate signed download URL: ${err.message}`);
    }
  }

  /**
   * Generates a pre-signed upload URL for direct browser/mobile uploads.
   * This allows clients to upload large assets directly to S3 without overloading API Gateway.
   */
  async getPresignedUploadUrl({
    key,
    contentType = 'image/jpeg',
    expiresInSeconds = STORAGE_LIMITS.DEFAULT_PRESIGNED_EXPIRES_SECONDS,
    isPublic = true,
  }) {
    if (!key) {
      throw new Error('StorageService.getPresignedUploadUrl: Destination key is required.');
    }

    const cleanKey = key.replace(/^\/+/, '');
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: cleanKey,
      ContentType: contentType,
      ACL: isPublic ? 'public-read' : 'private',
    });

    try {
      const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: expiresInSeconds });
      return {
        uploadUrl,
        key: cleanKey,
        publicUrl: isPublic ? this.getPublicUrl(cleanKey) : null,
        expiresIn: expiresInSeconds,
        bucket: this.bucket,
      };
    } catch (err) {
      throw new Error(`Failed to generate presigned upload URL: ${err.message}`);
    }
  }
}

// Export singleton instance for app-wide sharing
export const defaultStorageService = new StorageService();
