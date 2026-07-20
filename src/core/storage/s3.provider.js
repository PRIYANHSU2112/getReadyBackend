import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

/**
 * S3 storage provider stub — configure via env for production use.
 */
export class S3Provider {
  /**
   * @param {{ region: string, accessKeyId: string, secretAccessKey: string, bucket: string }} config
   */
  constructor(config) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async upload(file) {
    const key = `${uuidv4()}-${file.originalname}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );
    return {
      provider: 's3',
      key,
      url: this.getUrl(key),
    };
  }

  async delete(key) {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  getUrl(key) {
    return `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }
}
