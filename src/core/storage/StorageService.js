import { StorageProvider } from '../../common/constants/enums.js';
import { LocalProvider } from './local.provider.js';
import { S3Provider } from './s3.provider.js';
import { CloudinaryProvider } from './cloudinary.provider.js';
import { AppError } from '../../common/errors/AppError.js';

/**
 * Storage facade — selects provider from config.
 */
export class StorageService {
  /**
   * @param {object} storageConfig
   * @param {string} appUrl
   */
  constructor(storageConfig, appUrl) {
    this.providerName = storageConfig.provider;
    this.provider = this.#createProvider(storageConfig, appUrl);
  }

  #createProvider(storageConfig, appUrl) {
    switch (storageConfig.provider) {
      case StorageProvider.S3:
        return new S3Provider(storageConfig.s3);
      case StorageProvider.CLOUDINARY:
        return new CloudinaryProvider(storageConfig.cloudinary);
      case StorageProvider.LOCAL:
      default:
        return new LocalProvider(storageConfig.localPath, appUrl);
    }
  }

  async upload(file) {
    if (!file) throw new AppError('No file provided', 400, 'BAD_REQUEST');
    return this.provider.upload(file);
  }

  async delete(key) {
    return this.provider.delete(key);
  }

  getUrl(key) {
    return this.provider.getUrl(key);
  }
}
