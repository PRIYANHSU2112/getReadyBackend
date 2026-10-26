import { ApiResponse, HttpStatus, ErrorCodes } from '@getready/errors';

export class UploadController {
  constructor(storageService) {
    this.storageService = storageService;
  }

  uploadImage = async (req, res) => {
    if (!req.file) {
      return ApiResponse.error(res, 'No image file provided', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    const role = req.headers['x-user-role'];
    if (role && role !== 'admin' && role !== 'super_admin') {
      return ApiResponse.error(res, 'Insufficient permissions to upload assets', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }

    const { folder = 'admin-uploads' } = req.body || {};
    const result = await this.storageService.upload(req.file, folder, true);

    if (!result || !result.url) {
      return ApiResponse.error(res, 'Failed to upload image to storage', HttpStatus.INTERNAL_SERVER_ERROR, ErrorCodes.INTERNAL_ERROR);
    }

    return ApiResponse.success(
      res,
      {
        url: result.url,
        key: result.key || result.publicId,
        size: result.size,
        mimeType: result.mimeType,
      },
      'Image uploaded successfully',
      HttpStatus.CREATED
    );
  };
}
