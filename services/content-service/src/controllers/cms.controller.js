import { ApiResponse } from '@getready/errors';

export class CmsController {
  constructor(cmsService) {
    this.cmsService = cmsService;
  }

  list = async (req, res) => {
    const result = await this.cmsService.list(req.query);
    return ApiResponse.paginated(
      res,
      result.items,
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        hasNext: result.page < result.totalPages,
        hasPrevious: result.page > 1,
      },
      'CMS content fetched successfully',
    );
  };

  getById = async (req, res) => {
    const item = await this.cmsService.getById(req.params.id);
    return ApiResponse.success(res, item, 'CMS page fetched successfully');
  };

  create = async (req, res) => {
    const item = await this.cmsService.create(req.body);
    return ApiResponse.created(res, item, 'CMS page created successfully');
  };

  update = async (req, res) => {
    const item = await this.cmsService.update(req.params.id, req.body);
    return ApiResponse.success(res, item, 'CMS page updated successfully');
  };

  delete = async (req, res) => {
    const result = await this.cmsService.delete(req.params.id);
    return ApiResponse.success(res, result, 'CMS page deleted successfully');
  };
}
