import mongoose from 'mongoose';
import { ApiResponse, HttpStatus } from '@getready/errors';
import { searchService } from '../services/search.service.js';
import { indexerService } from '../services/indexer.service.js';
import { esWrapper } from '../client/elasticsearch.client.js';

export class SearchController {
  constructor(svc = searchService, indexer = indexerService) {
    this.searchService = svc;
    this.indexerService = indexer;
  }

  search = async (req, res) => {
    const result = await this.searchService.search(req.query);

    return ApiResponse.success(res, result, 'Search results retrieved successfully');
  };

  autocomplete = async (req, res) => {
    const query = {
      ...req.query,
      autocomplete: true,
      limit: req.query.limit || 8,
    };
    const result = await this.searchService.search(query);

    return ApiResponse.success(res, result, 'Autocomplete suggestions retrieved successfully');
  };

  reindex = async (req, res) => {
    const db = mongoose.connection.db;
    const result = await this.indexerService.reindexFromMongo(db);

    if (result.status === 'ERROR') {
      return ApiResponse.error(res, result.message || result.error, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return ApiResponse.success(res, result, 'Elasticsearch reindexing completed successfully');
  };

  health = async (req, res) => {
    const isEsHealthy = await esWrapper.checkHealth();
    return ApiResponse.success(res, {
      service: 'search-service',
      elasticsearch: isEsHealthy ? 'HEALTHY' : 'DEGRADED',
      timestamp: new Date().toISOString(),
    });
  };
}

export const searchController = new SearchController();
export default searchController;
