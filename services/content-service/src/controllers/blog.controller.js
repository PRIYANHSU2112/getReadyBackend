import { ApiResponse, HttpStatus } from '@getready/errors';
import { defaultStorageService } from '@getready/storage';

export class BlogController {
  constructor(blogService, storageService = defaultStorageService) {
    this.blogService = blogService;
    this.storageService = storageService;
  }

  home = async (req, res) => {
    const data = await this.blogService.getHome();
    return ApiResponse.success(res, data, 'Blog home retrieved successfully');
  };

  listPublic = async (req, res) => {
    const { limit = 10, page = 1, categoryId, sort } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const result = await this.blogService.listPublic({
      limit: Number(limit),
      skip,
      categoryId,
      sort,
    });
    return ApiResponse.success(res, result.blogs, 'Blogs retrieved successfully', HttpStatus.OK, {
      total: result.total,
      page: Number(page),
      limit: Number(limit),
    });
  };

  getPublic = async (req, res) => {
    const { id } = req.params;
    const blog = await this.blogService.getPublic(id);
    return ApiResponse.success(res, blog, 'Blog retrieved successfully');
  };

  like = async (req, res) => {
    const { id } = req.params;
    const result = await this.blogService.like(id);
    return ApiResponse.success(res, result, 'Blog liked successfully');
  };

  listManage = async (req, res) => {
    const { limit = 20, page = 1, status, categoryId } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const result = await this.blogService.listManage({
      limit: Number(limit),
      skip,
      status,
      categoryId,
    });
    return ApiResponse.success(res, result.blogs, 'Manage blogs retrieved successfully', HttpStatus.OK, {
      total: result.total,
      page: Number(page),
      limit: Number(limit),
    });
  };

  getById = async (req, res) => {
    const { id } = req.params;
    const blog = await this.blogService.getById(id);
    return ApiResponse.success(res, blog, 'Blog retrieved successfully');
  };

  create = async (req, res) => {
    const data = { ...req.body };
    if (req.file) {
      const uploadResult = await this.storageService.upload(req.file, 'blogs', true);
      if (uploadResult && uploadResult.url) {
        data.coverImageUrl = uploadResult.url;
      }
    }
    const blog = await this.blogService.create(data);
    return ApiResponse.success(res, blog, 'Blog created successfully', HttpStatus.CREATED);
  };

  update = async (req, res) => {
    const { id } = req.params;
    const data = { ...req.body };
    if (req.file) {
      const uploadResult = await this.storageService.upload(req.file, 'blogs', true);
      if (uploadResult && uploadResult.url) {
        data.coverImageUrl = uploadResult.url;
      }
    }
    const blog = await this.blogService.update(id, data);
    return ApiResponse.success(res, blog, 'Blog updated successfully');
  };

  remove = async (req, res) => {
    const { id } = req.params;
    await this.blogService.remove(id);
    return ApiResponse.success(res, null, 'Blog removed successfully');
  };
}
