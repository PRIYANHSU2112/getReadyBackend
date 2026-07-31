import { BaseService } from '../../common/base/BaseService.js';
import { AppError } from '../../common/errors/AppError.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import {
  CATEGORY_PUBLIC_CACHE_TTL_SECONDS,
  CATEGORY_SORT_FIELDS,
  DEFAULT_CATEGORY_SORT,
} from '../../common/constants/category.js';
import { buildPaginationMeta } from '../../common/helpers/pagination.helper.js';
import { parseListQuery } from '../../common/helpers/list-query.helper.js';
import { slugify } from '../../common/utils/slug.util.js';
import { TtlMemoryCache } from '../../core/cache/ttl-memory-cache.js';

const publicLocalCache = new TtlMemoryCache();

export class CategoryService extends BaseService {
  /**
   * @param {import('./category.repository.js').CategoryRepository} categoryRepository
   * @param {import('../../core/redis/cache.service.js').CacheService|null} cacheService
   * @param {import('../../core/storage/StorageService.js').StorageService|null} storageService
   */
  constructor(categoryRepository, cacheService = null, storageService = null) {
    super(null, cacheService);
    this.categoryRepository = categoryRepository;
    this.storageService = storageService;
  }

  #sanitize(doc) {
    if (!doc) return doc;
    const obj = typeof doc.toJSON === 'function' ? doc.toJSON() : { ...doc };
    if (obj._id) obj.id = obj._id.toString();
    if (obj.createdBy) obj.createdBy = obj.createdBy.toString();
    if (obj.updatedBy) obj.updatedBy = obj.updatedBy.toString();
    if (!obj.defaultPriceRange) {
      obj.defaultPriceRange = { min: null, max: null };
    }
    return obj;
  }

  #normalizeNullable(payload = {}) {
    const out = { ...payload };
    delete out.image;
    delete out.imageUrl;
    delete out.file;

    for (const key of ['description', 'icon', 'color']) {
      if (out[key] === '') out[key] = null;
    }

    for (const key of ['isActive', 'isFeatured']) {
      if (out[key] === 'true') out[key] = true;
      if (out[key] === 'false') out[key] = false;
    }

    if (typeof out.metadata === 'string') {
      try {
        out.metadata = JSON.parse(out.metadata);
      } catch {
        out.metadata = {};
      }
    }

    if (typeof out.defaultPriceRange === 'string') {
      try {
        out.defaultPriceRange = JSON.parse(out.defaultPriceRange);
      } catch {
        out.defaultPriceRange = { min: null, max: null };
      }
    }

    if (out.defaultPriceRange) {
      const { min, max } = out.defaultPriceRange;
      if (min != null && max != null && Number(min) > Number(max)) {
        throw new AppError(
          'defaultPriceRange.min must be <= defaultPriceRange.max',
          HttpStatus.UNPROCESSABLE,
          ErrorCodes.VALIDATION_ERROR,
        );
      }
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

  #resolveSlug(name, slug) {
    const resolved = slugify(slug || name);
    if (!resolved) {
      throw new AppError(
        'Unable to generate a valid slug',
        HttpStatus.UNPROCESSABLE,
        ErrorCodes.VALIDATION_ERROR,
      );
    }
    return resolved;
  }

  async #assertSlugUnique(slug, excludeId = null) {
    const existing = await this.categoryRepository.findBySlug(slug, { excludeId });
    if (existing) {
      throw new AppError(
        `Category slug "${slug}" already exists`,
        HttpStatus.CONFLICT,
        ErrorCodes.CONFLICT,
      );
    }
  }

  #publicListCacheKey({ featured } = {}) {
    if (featured === true) return this.cacheKey('category', 'public', 'featured');
    return this.cacheKey('category', 'public', 'all');
  }

  #publicSlugCacheKey(slug) {
    return this.cacheKey('category', 'public', 'slug', slug);
  }

  async #invalidatePublicCache() {
    const prefix = this.cacheKey('category', 'public');
    for (const key of [...publicLocalCache.store.keys()]) {
      if (key.startsWith(prefix)) publicLocalCache.delSync(key);
    }
    if (this.cacheService?.delByPattern) {
      await this.cacheService.delByPattern(`${prefix}*`);
    }
  }

  async listPublic(query = {}) {
    const featured = query.featured === true;
    const cacheKey = this.#publicListCacheKey({ featured });

    const local = publicLocalCache.getSync(cacheKey);
    if (local) return local;

    const cached = await this.getCached(cacheKey);
    if (cached) {
      publicLocalCache.setSync(cacheKey, cached, CATEGORY_PUBLIC_CACHE_TTL_SECONDS);
      return cached;
    }

    const data = await this.categoryRepository.listPublicSlim({
      featured: featured || undefined,
    });
    publicLocalCache.setSync(cacheKey, data, CATEGORY_PUBLIC_CACHE_TTL_SECONDS);
    await this.setCached(cacheKey, data, CATEGORY_PUBLIC_CACHE_TTL_SECONDS);
    return data;
  }

  async getPublicBySlug(slug) {
    const cacheKey = this.#publicSlugCacheKey(slug);

    const local = publicLocalCache.getSync(cacheKey);
    if (local) return local;

    const cached = await this.getCached(cacheKey);
    if (cached) {
      publicLocalCache.setSync(cacheKey, cached, CATEGORY_PUBLIC_CACHE_TTL_SECONDS);
      return cached;
    }

    const data = await this.categoryRepository.findPublicBySlug(slug);
    this.ensureFound(data, 'Category not found');
    publicLocalCache.setSync(cacheKey, data, CATEGORY_PUBLIC_CACHE_TTL_SECONDS);
    await this.setCached(cacheKey, data, CATEGORY_PUBLIC_CACHE_TTL_SECONDS);
    return data;
  }

  async list(query = {}) {
    const pagination = parseListQuery(query, {
      allowedSortFields: [...CATEGORY_SORT_FIELDS],
      defaultSort: DEFAULT_CATEGORY_SORT,
    });
    const filter = this.categoryRepository.buildAdminFilter(query);
    const { items, total } = await this.categoryRepository.listAdmin(filter, {
      skip: pagination.skip,
      limit: pagination.limit,
      sort: pagination.sort,
    });

    return {
      items: items.map((i) => this.#sanitize(i)),
      meta: buildPaginationMeta(total, pagination),
    };
  }

  async getById(id) {
    const category = await this.categoryRepository.findActiveById(id);
    return this.#sanitize(this.ensureFound(category, 'Category not found'));
  }

  async create(data, actorId = null, file = null) {
    const payload = this.#normalizeNullable(data);
    payload.slug = this.#resolveSlug(payload.name, payload.slug);
    await this.#assertSlugUnique(payload.slug);
    if (file) {
      payload.image = await this.#uploadImage(file);
    }
    if (actorId) {
      payload.createdBy = actorId;
      payload.updatedBy = actorId;
    }
    const created = await this.categoryRepository.create(payload);
    await this.#invalidatePublicCache();
    return this.#sanitize(created);
  }

  async update(id, data = {}, actorId = null, file = null) {
    const existing = await this.categoryRepository.findActiveById(id);
    this.ensureFound(existing, 'Category not found');

    const payload = this.#normalizeNullable(data);
    if (!Object.keys(payload).length && !file) {
      throw new AppError(
        'No fields to update',
        HttpStatus.UNPROCESSABLE,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    if (payload.slug || payload.name) {
      payload.slug = this.#resolveSlug(payload.name || existing.name, payload.slug);
      await this.#assertSlugUnique(payload.slug, id);
    }
    if (file) {
      payload.image = await this.#uploadImage(file);
      await this.#deleteStoredImage(existing.image?.publicId);
    }
    if (actorId) payload.updatedBy = actorId;

    const updated = await this.categoryRepository.updateById(id, payload);
    await this.#invalidatePublicCache();
    return this.#sanitize(this.ensureFound(updated, 'Category not found'));
  }

  async remove(id, actorId = null) {
    const existing = await this.categoryRepository.findActiveById(id);
    this.ensureFound(existing, 'Category not found');
    await this.categoryRepository.softDelete(id);
    await this.#deleteStoredImage(existing.image?.publicId);
    if (actorId) {
      await this.categoryRepository.updateById(id, { updatedBy: actorId });
    }
    await this.#invalidatePublicCache();
    return true;
  }

  async restore(id, actorId = null) {
    const existing = await this.categoryRepository.findByIdAny(id);
    this.ensureFound(existing, 'Category not found');
    if (!existing.deletedAt) {
      throw new AppError(
        'Category is not deleted',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.BAD_REQUEST,
      );
    }
    await this.#assertSlugUnique(existing.slug, id);
    const restored = await this.categoryRepository.restore(id);
    if (actorId) {
      await this.categoryRepository.updateById(id, { updatedBy: actorId });
    }
    await this.#invalidatePublicCache();
    return this.#sanitize(restored);
  }

  async setStatus(id, isActive, actorId = null) {
    const existing = await this.categoryRepository.findActiveById(id);
    this.ensureFound(existing, 'Category not found');
    const payload = { isActive };
    if (actorId) payload.updatedBy = actorId;
    const updated = await this.categoryRepository.updateById(id, payload);
    await this.#invalidatePublicCache();
    return this.#sanitize(updated);
  }

  async reorder(items = []) {
    await this.categoryRepository.reorder(items);
    await this.#invalidatePublicCache();
    return true;
  }

  async bulkSetStatus(ids, isActive) {
    await this.categoryRepository.bulkSetActive(ids, isActive);
    await this.#invalidatePublicCache();
    return true;
  }

  async bulkDelete(ids) {
    await this.categoryRepository.softDeleteMany(ids);
    await this.#invalidatePublicCache();
    return true;
  }
}
