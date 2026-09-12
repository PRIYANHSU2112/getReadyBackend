import { ApiResponse, HttpStatus } from '@getready/errors';
import { defaultStorageService } from '@getready/storage';

export class BannerController {
  constructor(bannerService, storageService = defaultStorageService) {
    this.bannerService = bannerService;
    this.storageService = storageService;
  }

  listActive = async (req, res) => {
    const banners = await this.bannerService.listActive();
    return ApiResponse.success(res, banners, 'Active banners retrieved successfully');
  };

  list = async (req, res) => {
    const { limit = 20, page = 1, isActive } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const parsedActive = isActive === undefined ? undefined : String(isActive) === 'true';

    const result = await this.bannerService.list({
      limit: Number(limit),
      skip,
      isActive: parsedActive,
    });

    return ApiResponse.success(res, result.banners, 'Banners retrieved successfully', HttpStatus.OK, {
      total: result.total,
      page: Number(page),
      limit: Number(limit),
    });
  };

  getById = async (req, res) => {
    const { id } = req.params;
    const banner = await this.bannerService.getById(id);
    return ApiResponse.success(res, banner, 'Banner retrieved successfully');
  };

  create = async (req, res) => {
    const data = { ...req.body };
    if (req.file) {
      const uploadResult = await this.storageService.upload(req.file, 'banners', true);
      if (uploadResult && uploadResult.url) {
        data.imageUrl = uploadResult.url;
      }
    }
    const banner = await this.bannerService.create(data);
    return ApiResponse.success(res, banner, 'Banner created successfully', HttpStatus.CREATED);
  };

  update = async (req, res) => {
    const { id } = req.params;
    const data = { ...req.body };
    if (req.file) {
      const uploadResult = await this.storageService.upload(req.file, 'banners', true);
      if (uploadResult && uploadResult.url) {
        data.imageUrl = uploadResult.url;
      }
    }
    const banner = await this.bannerService.update(id, data);
    return ApiResponse.success(res, banner, 'Banner updated successfully');
  };

  remove = async (req, res) => {
    const { id } = req.params;
    await this.bannerService.remove(id);
    return ApiResponse.success(res, null, 'Banner deleted successfully');
  };
}
