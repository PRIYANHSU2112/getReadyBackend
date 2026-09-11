import { S3Client } from '@aws-sdk/client-s3';

/**
 * Creates and initializes S3-compatible client for Linode Object Storage / DigitalOcean Spaces / AWS S3.
 * Strictly reads credentials from environment variables without exposing secrets.
 *
 * @param {Object} [configOverrides={}]
 * @returns {{ client: S3Client, bucket: string, endpoint: string, region: string }}
 */
export function createS3Client(configOverrides = {}) {
  const region =
    configOverrides.region ||
    process.env.LINODE_OBJECT_STORAGE_REGION ||
    process.env.AWS_REGION ||
    'sgp1';

  const endpoint =
    configOverrides.endpoint ||
    process.env.LINODE_OBJECT_STORAGE_ENDPOINT ||
    process.env.AWS_ENDPOINT ||
    'https://sgp1.digitaloceanspaces.com';

  const accessKeyId =
    configOverrides.accessKeyId ||
    process.env.LINODE_OBJECT_STORAGE_ACCESS_KEY_ID ||
    process.env.AWS_ACCESS_KEY_ID ||
    '';

  const secretAccessKey =
    configOverrides.secretAccessKey ||
    process.env.LINODE_OBJECT_STORAGE_SECRET_ACCESS_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY ||
    '';

  const bucket =
    configOverrides.bucket ||
    process.env.LINODE_OBJECT_BUCKET ||
    process.env.AWS_BUCKET_NAME ||
    process.env.AWS_S3_BUCKET_NAME ||
    'satyakabir-bucket';

  // Production Safety Validation
  if (process.env.NODE_ENV === 'production') {
    if (!bucket) {
      throw new Error('[Storage] Fatal: Object storage bucket name is missing in production environment.');
    }
    if (!accessKeyId || !secretAccessKey) {
      throw new Error('[Storage] Fatal: Object storage credentials missing in production environment.');
    }
  }

  const client = new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: false, // Standard virtual-hosted style for DO Spaces / Linode
  });

  return {
    client,
    bucket,
    endpoint,
    region,
  };
}
