import { StorageProvider } from '../../common/constants/enums.js';
import { uploadToS3, deleteFromS3, getS3Url } from './s3.provider.js';
import { AppError } from '../../common/errors/AppError.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';

/**
 * Storage facade — S3 only (uses uploadToS3).
 */
export class StorageService {

  constructor(_storageConfig, _appUrl) {
    this.providerName = StorageProvider.S3;
  }


  async upload(file) {
    if (!file?.buffer) {
      throw new AppError('No file provided', HttpStatus.BAD_REQUEST, ErrorCodes.BAD_REQUEST);
    }
    return uploadToS3(file.buffer, file.originalname, file.mimetype);
  }

  async delete(key) {
    return deleteFromS3(key);
  }

  getUrl(key) {
    return getS3Url(key);
  }
}
