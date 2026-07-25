import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import config from '../config/index.js';

const s3Config = config.storage.s3;

const clientOptions = {
  region: s3Config.region || 'us-east-1',
  credentials: {
    accessKeyId: s3Config.accessKeyId || '',
    secretAccessKey: s3Config.secretAccessKey || '',
  },
};

if (s3Config.endpoint) {
  clientOptions.endpoint = s3Config.endpoint;
  clientOptions.forcePathStyle = false;
}

/** Shared S3 client (AWS / DigitalOcean Spaces / Linode) */
export const s3 = new S3Client(clientOptions);

/**
 * Upload a buffer to S3.
 * @param {Buffer} fileBuffer
 * @param {string} fileName
 * @param {string} mimeType
 * @returns {Promise<{ key: string, url: string, provider: string }>}
 */
export async function uploadToS3(fileBuffer, fileName, mimeType) {
  const folder = (s3Config.folder || 'uploads').replace(/^\/+|\/+$/g, '');
  const key = `${folder}/${Date.now()}_${fileName}`;

  const params = {
    Bucket: s3Config.bucket,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType,
  };

  if (s3Config.publicRead !== false) {
    params.ACL = 'public-read';
  }

  await s3.send(new PutObjectCommand(params));

  return {
    provider: 's3',
    key,
    url: getS3Url(key),
  };
}


export function getS3Url(key) {
  if (s3Config.endpoint) {
    const host = s3Config.endpoint.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `https://${s3Config.bucket}.${host}/${key}`;
  }
  return `https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com/${key}`;
}


export async function deleteFromS3(key) {
  if (!key || !s3Config.bucket) return;
  await s3.send(
    new DeleteObjectCommand({
      Bucket: s3Config.bucket,
      Key: key,
    }),
  );
}

/** @deprecated Use uploadToS3 — kept for StorageService compatibility */
export class S3Provider {
  async upload(file) {
    return uploadToS3(file.buffer, file.originalname, file.mimetype);
  }

  async delete(key) {
    return deleteFromS3(key);
  }

  getUrl(key) {
    return getS3Url(key);
  }
}
