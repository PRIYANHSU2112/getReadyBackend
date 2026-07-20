import { v2 as cloudinary } from 'cloudinary';
import { v4 as uuidv4 } from 'uuid';

/**
 * Cloudinary storage provider stub.
 */
export class CloudinaryProvider {
  /**
   * @param {{ cloudName: string, apiKey: string, apiSecret: string }} config
   */
  constructor(config) {
    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
    });
    this.cloudinary = cloudinary;
  }

  async upload(file) {
    const publicId = uuidv4();
    const result = await new Promise((resolve, reject) => {
      const stream = this.cloudinary.uploader.upload_stream(
        { public_id: publicId, resource_type: 'auto' },
        (err, res) => (err ? reject(err) : resolve(res)),
      );
      stream.end(file.buffer);
    });

    return {
      provider: 'cloudinary',
      key: result.public_id,
      url: result.secure_url,
    };
  }

  async delete(key) {
    await this.cloudinary.uploader.destroy(key);
  }

  getUrl(key) {
    return this.cloudinary.url(key);
  }
}
