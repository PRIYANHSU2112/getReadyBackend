import { BaseService } from '../../common/base/BaseService.js';
import { AppError } from '../../common/errors/AppError.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import {
  MAX_BANNERS_PER_POSITION,
  BANNER_LIST_CACHE_TTL_SECONDS,
  BANNER_SORT_FIELDS,
  DEFAULT_BANNER_SORT,
} from '../../common/constants/banner.js';
import { BannerStatus } from '../../common/constants/enums.js';
import { buildPaginationMeta } from '../../common/helpers/pagination.helper.js';
import { parseListQuery } from '../../common/helpers/list-query.helper.js';
import { TtlMemoryCache } from '../../core/cache/ttl-memory-cache.js';

/** Process-local active-list cache — invalidated on write. */
const activeLocalCache = new TtlMemoryCache();

export class BannerService extends BaseService {
  /**
   * @param {import('./banner.repository.js').BannerRepository} bannerRepository
   * @param {import('../../core/redis/cache.service.js').CacheService|null} cacheService
   * @param {import('../../core/storage/StorageService.js').StorageService|null} storageService
   * @param {import('../category/category.repository.js').CategoryRepository|null} categoryRepository
   */
  constructor(
    bannerRepository,
    cacheService = null,
    storageService = null,
    categoryRepository = null,
  ) {
    super(null, cacheService);
    this.bannerRepository = bannerRepository;
    this.storageService = storageService;
    this.categoryRepository = categoryRepository;
  }

  #sanitize(banner) {
    if (!banner) return banner;
    const obj = typeof banner.toJSON === 'function' ? banner.toJSON() : { ...banner };
    if (obj._id) obj.id = obj._id.toString();
    if (obj.categoryId) obj.categoryId = obj.categoryId.toString();
    if (Array.isArray(obj.serviceIds)) {
      obj.serviceIds = obj.serviceIds.map((id) => id?.toString?.() || id);
    }
    if (obj.image?.url) {
      obj.imageUrl = obj.image.url;
    }
    return obj;
  }

  #normalizePayload(data = {}) {
    const payload = { ...data };
    delete payload.imageUrl;
    delete payload.image;
    delete payload.file;

    if (payload.linkUrl === '') payload.linkUrl = null;
    if (payload.serviceCategory === '') payload.serviceCategory = null;
    if (payload.categoryId === '') payload.categoryId = null;
    if (payload.startAt === undefined) delete payload.startAt;
    if (payload.endAt === undefined) delete payload.endAt;

    if (typeof payload.serviceIds === 'string') {
      const raw = payload.serviceIds.trim();
      if (!raw) {
        payload.serviceIds = [];
      } else {
        try {
          const parsed = JSON.parse(raw);
          payload.serviceIds = Array.isArray(parsed) ? parsed : [raw];
        } catch {
          payload.serviceIds = raw.split(',').map((s) => s.trim()).filter(Boolean);
        }
      }
    }

    return payload;
  }

  /**
   * Resolve categoryId → active Category; denormalize slug into serviceCategory.
   */
  async #applyCategoryRef(payload) {
    if (payload.categoryId === undefined) return payload;
    if (payload.categoryId === null) {
      return payload;
    }
    if (!this.categoryRepository) {
      throw new AppError(
        'Category lookup is not configured',
        HttpStatus.INTERNAL_ERROR,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
    const category = await this.categoryRepository.findActiveById(payload.categoryId);
    if (!category || !category.isActive) {
      throw new AppError(
        'Category not found or inactive',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
      );
    }
    payload.serviceCategory = category.slug;
    return payload;
  }

  async #resolveListQuery(query = {}) {
    const out = { ...query };
    if (out.categoryId && this.categoryRepository) {
      const category = await this.categoryRepository.findActiveById(out.categoryId);
      if (category) out.categorySlug = category.slug;
    }
    return out;
  }

  async #uploadImage(file) {
    if (!this.storageService) {
      throw new AppError(
        'Storage service is not configured',
        HttpStatus.INTERNAL_ERROR,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
    const uploaded = await this.storageService.upload(file);
    return {
      url: uploaded.url,
      publicId: uploaded.key,
    };
  }

  async #deleteStoredImage(publicId) {
    if (!publicId || !this.storageService) return;
    try {
      await this.storageService.delete(publicId);
    } catch {
      // best-effort cleanup
    }
  }

  #activeCacheKey(query, pagination) {
    return this.cacheKey(
      'banner',
      'active',
      query.position ?? 'all',
      query.categoryId ?? 'all',
      query.serviceCategory ?? 'all',
      query.serviceId ?? 'all',
      query.platform ?? 'all',
      query.type ?? 'all',
      pagination.page,
      pagination.limit,
      pagination.sort,
    );
  }

  async #invalidateActiveCache() {
    const prefix = this.cacheKey('banner', 'active');
    for (const key of [...activeLocalCache.store.keys()]) {
      if (key.startsWith(prefix)) activeLocalCache.delSync(key);
    }
    if (this.cacheService?.delByPattern) {
      await this.cacheService.delByPattern(`${prefix}*`);
    }
  }

  async listActive(query = {}) {
    const pagination = parseListQuery(query, {
      allowedSortFields: [...BANNER_SORT_FIELDS],
      defaultSort: DEFAULT_BANNER_SORT,
    });
    const resolvedQuery = await this.#resolveListQuery(query);
    const cacheKey = this.#activeCacheKey(resolvedQuery, pagination);

    const local = activeLocalCache.getSync(cacheKey);
    if (local) return local;

    const cached = await this.getCached(cacheKey);
    if (cached) {
      activeLocalCache.setSync(cacheKey, cached, BANNER_LIST_CACHE_TTL_SECONDS);
      return cached;
    }

    const filter = this.bannerRepository.buildActiveFilter(resolvedQuery);
    const { items, total } = await this.bannerRepository.listActivePublic(filter, {
      skip: pagination.skip,
      limit: pagination.limit,
      sort: pagination.sort,
    });

    const result = {
      items: items.map((b) => this.#sanitize(b)),
      meta: buildPaginationMeta(total, pagination),
    };

    activeLocalCache.setSync(cacheKey, result, BANNER_LIST_CACHE_TTL_SECONDS);
    await this.setCached(cacheKey, result, BANNER_LIST_CACHE_TTL_SECONDS);
    return result;
  }

  async list(query = {}) {
    const pagination = parseListQuery(query, {
      allowedSortFields: [...BANNER_SORT_FIELDS],
      defaultSort: DEFAULT_BANNER_SORT,
    });
    const resolvedQuery = await this.#resolveListQuery(query);
    const filter = this.bannerRepository.buildAdminFilter(resolvedQuery);
    const { items, total } = await this.bannerRepository.listAdmin(filter, {
      skip: pagination.skip,
      limit: pagination.limit,
      sort: pagination.sort,
    });
    return {
      items: items.map((b) => this.#sanitize(b)),
      meta: buildPaginationMeta(total, pagination),
    };
  }

  async getById(id) {
    const banner = await this.bannerRepository.findActiveById(id);
    return this.#sanitize(this.ensureFound(banner, 'Banner not found'));
  }

  async create(data, file = null) {
    if (!file) {
      throw new AppError(
        'Banner image file is required',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    const payload = this.#normalizePayload(data);
    const status = payload.status || BannerStatus.INACTIVE;
    const position = payload.position;

    if (status === BannerStatus.ACTIVE) {
      const count = await this.bannerRepository.countActiveAtPosition(position);
      if (count >= MAX_BANNERS_PER_POSITION) {
        throw new AppError(
          `Maximum of ${MAX_BANNERS_PER_POSITION} active banners allowed at position ${position}`,
          HttpStatus.BAD_REQUEST,
          ErrorCodes.VALIDATION_ERROR,
        );
      }
    }

    if (payload.startAt && payload.endAt && new Date(payload.endAt) < new Date(payload.startAt)) {
      throw new AppError(
        'endAt must be >= startAt',
        HttpStatus.UNPROCESSABLE,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    await this.#applyCategoryRef(payload);
    payload.image = await this.#uploadImage(file);

    const created = await this.bannerRepository.create(payload);
    await this.#invalidateActiveCache();
    return this.#sanitize(created);
  }

  async update(id, data = {}, file = null) {
    const existing = await this.bannerRepository.findActiveById(id);
    this.ensureFound(existing, 'Banner not found');

    const payload = this.#normalizePayload(data);
    if (!Object.keys(payload).length && !file) {
      throw new AppError(
        'No fields to update',
        HttpStatus.UNPROCESSABLE,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    const nextStatus = payload.status ?? existing.status;
    const nextPosition = payload.position ?? existing.position;

    if (nextStatus === BannerStatus.ACTIVE) {
      const count = await this.bannerRepository.countActiveAtPosition(nextPosition);
      const wasActiveHere =
        existing.status === BannerStatus.ACTIVE && existing.position === nextPosition;
      const effectiveCount = wasActiveHere ? count : count + 1;
      if (effectiveCount > MAX_BANNERS_PER_POSITION) {
        throw new AppError(
          `Maximum of ${MAX_BANNERS_PER_POSITION} active banners allowed at position ${nextPosition}`,
          HttpStatus.BAD_REQUEST,
          ErrorCodes.VALIDATION_ERROR,
        );
      }
    }

    const startAt = payload.startAt !== undefined ? payload.startAt : existing.startAt;
    const endAt = payload.endAt !== undefined ? payload.endAt : existing.endAt;
    if (startAt && endAt && new Date(endAt) < new Date(startAt)) {
      throw new AppError(
        'endAt must be >= startAt',
        HttpStatus.UNPROCESSABLE,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    await this.#applyCategoryRef(payload);

    if (file) {
      payload.image = await this.#uploadImage(file);
      await this.#deleteStoredImage(existing.image?.publicId);
    }

    const updated = await this.bannerRepository.updateById(id, payload);
    await this.#invalidateActiveCache();
    return this.#sanitize(this.ensureFound(updated, 'Banner not found'));
  }

  async remove(id) {
    const existing = await this.bannerRepository.findActiveById(id);
    this.ensureFound(existing, 'Banner not found');
    await this.bannerRepository.softDelete(id);
    await this.#deleteStoredImage(existing.image?.publicId);
    await this.#invalidateActiveCache();
    return true;
  }
}
