import multer from 'multer';
import { Router } from 'express';
import { defaultStorageService, buildObjectKey, validateImageUpload, validateDocumentUpload } from '@getready/storage';
import { ApiResponse, HttpStatus, ErrorCodes } from '@getready/errors';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

export function createUploadRouter() {
  const router = Router();

  /**
   * POST /api/v1/uploads/presign
   * Generates a direct presigned upload URL for S3 / DigitalOcean Spaces.
   */
  router.post('/presign', async (req, res, next) => {
    try {
      const { fileName = 'file.jpg', contentType = 'image/jpeg', folder = 'uploads', isPublic = true } = req.body;

      if (!contentType) {
        return ApiResponse.error(res, 'contentType is required', HttpStatus.BAD_REQUEST, ErrorCodes.BAD_REQUEST);
      }

      const key = buildObjectKey(folder, {}, contentType, fileName);
      const presigned = await defaultStorageService.getPresignedUploadUrl({
        key,
        contentType,
        isPublic: isPublic !== false,
      });

      return ApiResponse.success(res, presigned, 'Presigned upload URL generated successfully');
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/v1/uploads/direct
   * Direct single-file multipart upload to DigitalOcean Spaces via StorageService.
   */
  router.post('/direct', upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) {
        return ApiResponse.error(res, 'No file uploaded', HttpStatus.BAD_REQUEST, ErrorCodes.BAD_REQUEST);
      }

      const { folder = 'general', isPublic = 'true' } = req.body;
      const key = buildObjectKey(folder, {}, req.file.mimetype, req.file.originalname);

      const result = await defaultStorageService.uploadBuffer({
        buffer: req.file.buffer,
        key,
        contentType: req.file.mimetype,
        isPublic: isPublic !== 'false',
      });

      return ApiResponse.success(res, result, 'File uploaded to storage successfully', HttpStatus.CREATED);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
