import { ApiResponse } from '@getready/errors';

export class SupportController {
  constructor(supportService) {
    this.supportService = supportService;
  }

  list = async (req, res) => {
    const result = await this.supportService.list(req.query);
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
      'Support tickets fetched successfully',
    );
  };

  getById = async (req, res) => {
    const item = await this.supportService.getById(req.params.id);
    return ApiResponse.success(res, item, 'Support ticket fetched successfully');
  };

  create = async (req, res) => {
    const item = await this.supportService.create(req.body);
    return ApiResponse.created(res, item, 'Support ticket created successfully');
  };

  update = async (req, res) => {
    const item = await this.supportService.update(req.params.id, req.body);
    return ApiResponse.success(res, item, 'Support ticket updated successfully');
  };

  delete = async (req, res) => {
    const result = await this.supportService.delete(req.params.id);
    return ApiResponse.success(res, result, 'Support ticket deleted successfully');
  };
}
