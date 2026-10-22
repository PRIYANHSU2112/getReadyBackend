import { ApiResponse, HttpStatus } from '@getready/errors';
import { homeFeedService } from '../services/home-feed.service.js';

export class HomeFeedController {
  constructor(feedService = homeFeedService) {
    this.feedService = feedService;
  }

  getFeed = async (req, res) => {
    const { city = 'all', refresh = 'false' } = req.query;
    const shouldRefresh = String(refresh).toLowerCase() === 'true';

    const feed = await this.feedService.getFeed({
      city,
      refresh: shouldRefresh,
    });

    return ApiResponse.success(res, feed, 'Home feed retrieved successfully');
  };

  refreshFeed = async (req, res) => {
    const { city = 'all' } = req.body || {};
    const feed = await this.feedService.precomputeAndCache(city);
    return ApiResponse.success(res, feed, 'Home feed materialized view refreshed successfully');
  };
}

export const homeFeedController = new HomeFeedController();
export default homeFeedController;
