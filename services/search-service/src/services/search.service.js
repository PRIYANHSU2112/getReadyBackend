import { logger } from '@getready/logger';
import { esClient } from '../client/elasticsearch.client.js';
import { BEAUTICIANS_INDEX } from '../indices/beauticians.index.js';
import { SERVICES_INDEX } from '../indices/services.index.js';

export class SearchService {
  constructor(client = esClient) {
    this.client = client;
  }

  /**
   * Unified Search API supporting:
   * - type: 'beautician' | 'service' | 'all'
   * - fuzzy typo-tolerant queries ('fashial' -> 'facial')
   * - autocomplete prefix matching
   * - geo-distance filtering and sorting
   * - faceted filtering (price, rating, category, availability)
   */
  async search(params) {
    const {
      q = '',
      type = 'all',
      lat,
      lon,
      radius = '15km',
      minPrice,
      maxPrice,
      minRating,
      category,
      gender,
      isOnline,
      page = 1,
      limit = 20,
      sort = 'relevance',
      autocomplete = false,
    } = params;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const from = (parsedPage - 1) * parsedLimit;

    const cleanQuery = String(q || '').trim();
    const searchType = String(type || 'all').toLowerCase();

    // 1. If searching specifically for services
    if (searchType === 'service') {
      return this.searchServices({
        q: cleanQuery,
        minPrice,
        maxPrice,
        minRating,
        category,
        gender,
        from,
        limit: parsedLimit,
        sort,
        autocomplete,
        page: parsedPage,
      });
    }

    // 2. If searching specifically for beauticians
    if (searchType === 'beautician') {
      return this.searchBeauticians({
        q: cleanQuery,
        lat,
        lon,
        radius,
        minPrice,
        maxPrice,
        minRating,
        isOnline,
        from,
        limit: parsedLimit,
        sort,
        autocomplete,
        page: parsedPage,
      });
    }

    // 3. Search both concurrently (type=all)
    const [servicesRes, beauticiansRes] = await Promise.all([
      this.searchServices({
        q: cleanQuery,
        minPrice,
        maxPrice,
        minRating,
        category,
        gender,
        from,
        limit: Math.ceil(parsedLimit / 2),
        sort,
        autocomplete,
        page: parsedPage,
      }),
      this.searchBeauticians({
        q: cleanQuery,
        lat,
        lon,
        radius,
        minPrice,
        maxPrice,
        minRating,
        isOnline,
        from,
        limit: Math.ceil(parsedLimit / 2),
        sort,
        autocomplete,
        page: parsedPage,
      }),
    ]);

    return {
      type: 'all',
      query: cleanQuery,
      total: (servicesRes.total || 0) + (beauticiansRes.total || 0),
      services: servicesRes.items || [],
      beauticians: beauticiansRes.items || [],
      meta: {
        page: parsedPage,
        limit: parsedLimit,
        servicesTotal: servicesRes.total,
        beauticiansTotal: beauticiansRes.total,
      },
    };
  }

  /**
   * Search Services Index
   */
  async searchServices(options) {
    const {
      q,
      minPrice,
      maxPrice,
      minRating,
      category,
      gender,
      from = 0,
      limit = 20,
      sort,
      autocomplete,
      page = 1,
    } = options;

    const must = [];
    const filter = [{ term: { isActive: true } }, { term: { status: 'APPROVED' } }];

    // Text Search / Autocomplete
    if (q) {
      if (autocomplete) {
        must.push({
          match_phrase_prefix: {
            'name.autocomplete': {
              query: q,
              max_expansions: 10,
            },
          },
        });
      } else {
        must.push({
          multi_match: {
            query: q,
            fields: ['name^3', 'name.autocomplete^2', 'category^2', 'description'],
            fuzziness: 'AUTO',
            prefix_length: 2,
            operator: 'or',
          },
        });
      }
    } else {
      must.push({ match_all: {} });
    }

    // Filters
    if (category) filter.push({ match: { category } });
    if (gender && gender !== 'all') filter.push({ terms: { gender: [gender, 'all', 'unisex'] } });
    if (minRating) filter.push({ range: { rating: { gte: Number(minRating) } } });

    if (minPrice || maxPrice) {
      const priceRange = {};
      if (minPrice) priceRange.gte = Number(minPrice);
      if (maxPrice) priceRange.lte = Number(maxPrice);
      filter.push({ range: { price: priceRange } });
    }

    // Sorting
    const sortConfig = [];
    if (sort === 'price_asc') sortConfig.push({ price: { order: 'asc' } });
    else if (sort === 'price_desc') sortConfig.push({ price: { order: 'desc' } });
    else if (sort === 'rating_desc') sortConfig.push({ rating: { order: 'desc' } });
    else sortConfig.push({ _score: { order: 'desc' } }, { rating: { order: 'desc' } });

    try {
      const response = await this.client.search({
        index: SERVICES_INDEX,
        from,
        size: limit,
        body: {
          query: {
            bool: {
              must,
              filter,
            },
          },
          sort: sortConfig,
        },
      });

      const hits = response.hits?.hits || [];
      const total = typeof response.hits?.total === 'number' ? response.hits.total : response.hits?.total?.value || 0;

      const items = hits.map((hit) => ({
        id: hit._source.id || hit._id,
        name: hit._source.name,
        category: hit._source.category,
        categoryId: hit._source.categoryId,
        description: hit._source.description,
        price: hit._source.price,
        discountedPrice: hit._source.discountedPrice,
        duration: hit._source.duration,
        rating: hit._source.rating,
        ratingCount: hit._source.ratingCount,
        bestseller: hit._source.bestseller,
        imageUrl: hit._source.imageUrl,
        score: hit._score,
      }));

      return {
        type: 'service',
        query: q,
        total,
        page,
        limit,
        items,
      };
    } catch (err) {
      logger.error({ err: err.message, q }, 'Elasticsearch services search error');
      return {
        type: 'service',
        query: q,
        total: 0,
        page,
        limit,
        items: [],
        degraded: true,
      };
    }
  }

  /**
   * Search Beauticians Index with Geo-Distance support
   */
  async searchBeauticians(options) {
    const {
      q,
      lat,
      lon,
      radius = '15km',
      minPrice,
      maxPrice,
      minRating,
      isOnline,
      from = 0,
      limit = 20,
      sort,
      autocomplete,
      page = 1,
    } = options;

    const must = [];
    const filter = [{ term: { isActive: true } }];

    // Text Search / Autocomplete
    if (q) {
      if (autocomplete) {
        must.push({
          match_phrase_prefix: {
            'name.autocomplete': {
              query: q,
              max_expansions: 10,
            },
          },
        });
      } else {
        must.push({
          multi_match: {
            query: q,
            fields: ['name^3', 'name.autocomplete^2', 'services^2', 'bio', 'city'],
            fuzziness: 'AUTO',
            prefix_length: 2,
            operator: 'or',
          },
        });
      }
    } else {
      must.push({ match_all: {} });
    }

    // Filters
    if (isOnline !== undefined) {
      const onlineFlag = String(isOnline) === 'true';
      filter.push({ term: { operationalStatus: onlineFlag ? 'ONLINE' : 'OFFLINE' } });
    }
    if (minRating) filter.push({ range: { rating: { gte: Number(minRating) } } });
    if (minPrice || maxPrice) {
      const priceRange = {};
      if (minPrice) priceRange.gte = Number(minPrice);
      if (maxPrice) priceRange.lte = Number(maxPrice);
      filter.push({ range: { price: priceRange } });
    }

    // Geo-distance Filter
    const hasCoordinates = lat !== undefined && lon !== undefined && !isNaN(Number(lat)) && !isNaN(Number(lon));
    if (hasCoordinates) {
      filter.push({
        geo_distance: {
          distance: radius,
          location: {
            lat: Number(lat),
            lon: Number(lon),
          },
        },
      });
    }

    // Sorting
    const sortConfig = [];
    if (hasCoordinates && sort === 'distance') {
      sortConfig.push({
        _geo_distance: {
          location: {
            lat: Number(lat),
            lon: Number(lon),
          },
          order: 'asc',
          unit: 'km',
          mode: 'min',
          distance_type: 'arc',
        },
      });
    } else if (sort === 'rating_desc') {
      sortConfig.push({ rating: { order: 'desc' } });
    } else if (sort === 'price_asc') {
      sortConfig.push({ price: { order: 'asc' } });
    } else {
      sortConfig.push({ _score: { order: 'desc' } }, { rating: { order: 'desc' } });
    }

    try {
      const response = await this.client.search({
        index: BEAUTICIANS_INDEX,
        from,
        size: limit,
        body: {
          query: {
            bool: {
              must,
              filter,
            },
          },
          sort: sortConfig,
        },
      });

      const hits = response.hits?.hits || [];
      const total = typeof response.hits?.total === 'number' ? response.hits.total : response.hits?.total?.value || 0;

      const items = hits.map((hit) => {
        const distanceKm = hit.sort?.[0] && hasCoordinates && sort === 'distance' ? Number(hit.sort[0]).toFixed(1) : null;

        return {
          id: hit._source.id || hit._id,
          userId: hit._source.userId,
          name: hit._source.name,
          bio: hit._source.bio,
          services: hit._source.services,
          rating: hit._source.rating,
          ratingCount: hit._source.ratingCount,
          price: hit._source.price,
          city: hit._source.city,
          address: hit._source.address,
          operationalStatus: hit._source.operationalStatus,
          isAvailable: hit._source.isAvailable,
          experienceYears: hit._source.experienceYears,
          avatarUrl: hit._source.avatarUrl,
          distanceKm,
          score: hit._score,
        };
      });

      return {
        type: 'beautician',
        query: q,
        total,
        page,
        limit,
        items,
      };
    } catch (err) {
      logger.error({ err: err.message, q }, 'Elasticsearch beauticians search error');
      return {
        type: 'beautician',
        query: q,
        total: 0,
        page,
        limit,
        items: [],
        degraded: true,
      };
    }
  }
}

export const searchService = new SearchService();
export default searchService;
