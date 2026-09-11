import { ApiResponse } from '@getready/errors';

export class ReviewController {
  constructor(reviewService) {
    this.reviewService = reviewService;
  }

  list = async (req, res) => {
    const result = await this.reviewService.list(req.query);
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
      'Reviews fetched successfully',
    );
  };

  getById = async (req, res) => {
    const item = await this.reviewService.getById(req.params.id);
    return ApiResponse.success(res, item, 'Review fetched successfully');
  };

  create = async (req, res) => {
    const item = await this.reviewService.create(req.body);
    return ApiResponse.created(res, item, 'Review created successfully');
  };

  update = async (req, res) => {
    const item = await this.reviewService.update(req.params.id, req.body);
    return ApiResponse.success(res, item, 'Review updated successfully');
  };

  delete = async (req, res) => {
    const result = await this.reviewService.delete(req.params.id);
    return ApiResponse.success(res, result, 'Review deleted successfully');
  };
}
