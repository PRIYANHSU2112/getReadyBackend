import { BaseService } from '../../common/base/BaseService.js';
import { AppError } from '../../common/errors/AppError.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import { FilterSelectionType } from '../../common/constants/enums.js';
import {
  FILTER_PUBLIC_CACHE_TTL_SECONDS,
  FILTER_SORT_FIELDS,
  DEFAULT_FILTER_SORT,
  FILTER_VALUE_SORT_FIELDS,
  DEFAULT_FILTER_VALUE_SORT,
} from '../../common/constants/filter.js';
import { buildPaginationMeta } from '../../common/helpers/pagination.helper.js';
import { parseListQuery } from '../../common/helpers/list-query.helper.js';
import { slugify } from '../../common/utils/slug.util.js';
import { TtlMemoryCache } from '../../core/cache/ttl-memory-cache.js';

const publicLocalCache = new TtlMemoryCache();

export class FilterService extends BaseService {
  /**
   * @param {import('./filter.repository.js').FilterRepository} filterRepository
   * @param {import('./filter-value.repository.js').FilterValueRepository} filterValueRepository
   * @param {import('../../core/redis/cache.service.js').CacheService|null} cacheService
   * @param {import('../../core/storage/StorageService.js').StorageService|null} storageService
   */
  constructor(
    filterRepository,
    filterValueRepository,
    cacheService = null,
    storageService = null,
  ) {
    super(null, cacheService);
    this.filterRepository = filterRepository;
    this.filterValueRepository = filterValueRepository;
    this.storageService = storageService;
  }

  #sanitize(doc) {
    if (!doc) return doc;
    const obj = typeof doc.toJSON === 'function' ? doc.toJSON() : { ...doc };
    if (obj._id) obj.id = obj._id.toString();
    if (obj.filterId) obj.filterId = obj.filterId.toString();
    if (obj.createdBy) obj.createdBy = obj.createdBy.toString();
    if (obj.updatedBy) obj.updatedBy = obj.updatedBy.toString();
    if (obj.image?.url) obj.imageUrl = obj.image.url;
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

    for (const key of [
      'isSearchable',
      'isRequired',
      'isActive',
      'isFeatured',
      'isDefault',
    ]) {
      if (out[key] === 'true') out[key] = true;
      if (out[key] === 'false') out[key] = false;
    }

    if (typeof out.scopes === 'string') {
      const raw = out.scopes.trim();
      if (!raw) out.scopes = [];
      else {
        try {
          const parsed = JSON.parse(raw);
          out.scopes = Array.isArray(parsed) ? parsed : [raw];
        } catch {
          out.scopes = raw.split(',').map((s) => s.trim()).filter(Boolean);
        }
      }
    }

    if (typeof out.metadata === 'string') {
      try {
        out.metadata = JSON.parse(out.metadata);
      } catch {
        out.metadata = {};
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

  async #assertGroupSlugUnique(slug, excludeId = null) {
    const existing = await this.filterRepository.findBySlug(slug, { excludeId });
    if (existing) {
      throw new AppError(
        `Filter slug "${slug}" already exists`,
        HttpStatus.CONFLICT,
        ErrorCodes.CONFLICT,
      );
    }
  }

  async #assertValueSlugUnique(filterId, slug, excludeId = null) {
    const existing = await this.filterValueRepository.findBySlug(filterId, slug, {
      excludeId,
    });
    if (existing) {
      throw new AppError(
        `Filter value slug "${slug}" already exists for this filter`,
        HttpStatus.CONFLICT,
        ErrorCodes.CONFLICT,
      );
    }
  }

  #publicCacheKey(scope) {
    return this.cacheKey('filter', 'public', scope || 'all');
  }

  async #invalidatePublicCache() {
    const prefix = this.cacheKey('filter', 'public');
    for (const key of [...publicLocalCache.store.keys()]) {
      if (key.startsWith(prefix)) publicLocalCache.delSync(key);
    }
    if (this.cacheService?.delByPattern) {
      await this.cacheService.delByPattern(`${prefix}*`);
    }
  }

  async listPublic(query = {}) {
    const scope = query.scope || null;
    const cacheKey = this.#publicCacheKey(scope);

    const local = publicLocalCache.getSync(cacheKey);
    if (local) return local;

    const cached = await this.getCached(cacheKey);
    if (cached) {
      publicLocalCache.setSync(cacheKey, cached, FILTER_PUBLIC_CACHE_TTL_SECONDS);
      return cached;
    }

    const data = await this.filterRepository.listPublicSlim(scope);
    publicLocalCache.setSync(cacheKey, data, FILTER_PUBLIC_CACHE_TTL_SECONDS);
    await this.setCached(cacheKey, data, FILTER_PUBLIC_CACHE_TTL_SECONDS);
    return data;
  }

  async list(query = {}) {
    const pagination = parseListQuery(query, {
      allowedSortFields: [...FILTER_SORT_FIELDS],
      defaultSort: DEFAULT_FILTER_SORT,
    });
    const filter = this.filterRepository.buildAdminFilter(query);
    const { items, total } = await this.filterRepository.listAdmin(filter, {
      skip: pagination.skip,
      limit: pagination.limit,
      sort: pagination.sort,
    });

    let sanitized = items.map((i) => this.#sanitize(i));
    if (query.includeValues) {
      const ids = sanitized.map((i) => i.id);
      const values = await this.filterValueRepository.listActiveByFilterIds(ids);
      const byFilter = new Map();
      for (const v of values) {
        const key = v.filterId.toString();
        if (!byFilter.has(key)) byFilter.set(key, []);
        byFilter.get(key).push(this.#sanitize(v));
      }
      sanitized = sanitized.map((g) => ({
        ...g,
        values: byFilter.get(g.id) || [],
      }));
    }

    return {
      items: sanitized,
      meta: buildPaginationMeta(total, pagination),
    };
  }

  async getById(id, { includeValues = false } = {}) {
    const filter = await this.filterRepository.findActiveById(id);
    const sanitized = this.#sanitize(this.ensureFound(filter, 'Filter not found'));
    if (!includeValues) return sanitized;
    const { items } = await this.filterValueRepository.listByFilter(
      { filterId: id, deletedAt: null },
      { skip: 0, limit: 1000, sort: DEFAULT_FILTER_VALUE_SORT },
    );
    return { ...sanitized, values: items.map((v) => this.#sanitize(v)) };
  }

  async create(data, actorId = null, file = null) {
    const payload = this.#normalizeNullable(data);
    payload.slug = this.#resolveSlug(payload.name, payload.slug);
    await this.#assertGroupSlugUnique(payload.slug);
    if (file) {
      payload.image = await this.#uploadImage(file);
    }
    if (actorId) {
      payload.createdBy = actorId;
      payload.updatedBy = actorId;
    }
    const created = await this.filterRepository.create(payload);
    await this.#invalidatePublicCache();
    return this.#sanitize(created);
  }

  async update(id, data = {}, actorId = null, file = null) {
    const existing = await this.filterRepository.findActiveById(id);
    this.ensureFound(existing, 'Filter not found');

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
      await this.#assertGroupSlugUnique(payload.slug, id);
    }
    if (file) {
      payload.image = await this.#uploadImage(file);
      await this.#deleteStoredImage(existing.image?.publicId);
    }
    if (actorId) payload.updatedBy = actorId;

    const updated = await this.filterRepository.updateById(id, payload);
    await this.#invalidatePublicCache();
    return this.#sanitize(this.ensureFound(updated, 'Filter not found'));
  }

  async remove(id, actorId = null) {
    const existing = await this.filterRepository.findActiveById(id);
    this.ensureFound(existing, 'Filter not found');
    await this.filterRepository.softDelete(id);
    await this.filterValueRepository.softDeleteByFilterId(id);
    await this.#deleteStoredImage(existing.image?.publicId);
    if (actorId) {
      await this.filterRepository.updateById(id, { updatedBy: actorId });
    }
    await this.#invalidatePublicCache();
    return true;
  }

  async restore(id, actorId = null) {
    const existing = await this.filterRepository.findByIdAny(id);
    this.ensureFound(existing, 'Filter not found');
    if (!existing.deletedAt) {
      throw new AppError(
        'Filter is not deleted',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.BAD_REQUEST,
      );
    }
    await this.#assertGroupSlugUnique(existing.slug, id);
    const restored = await this.filterRepository.restore(id);
    if (actorId) {
      await this.filterRepository.updateById(id, { updatedBy: actorId });
    }
    await this.#invalidatePublicCache();
    return this.#sanitize(restored);
  }

  async setStatus(id, isActive, actorId = null) {
    const existing = await this.filterRepository.findActiveById(id);
    this.ensureFound(existing, 'Filter not found');
    const payload = { isActive };
    if (actorId) payload.updatedBy = actorId;
    const updated = await this.filterRepository.updateById(id, payload);
    await this.#invalidatePublicCache();
    return this.#sanitize(updated);
  }

  async reorder(items = []) {
    await this.filterRepository.reorder(items);
    await this.#invalidatePublicCache();
    return true;
  }

  async bulkSetStatus(ids, isActive) {
    await this.filterRepository.bulkSetActive(ids, isActive);
    await this.#invalidatePublicCache();
    return true;
  }

  async bulkDelete(ids) {
    await this.filterRepository.softDeleteMany(ids);
    for (const id of ids) {
      await this.filterValueRepository.softDeleteByFilterId(id);
    }
    await this.#invalidatePublicCache();
    return true;
  }

  async listValues(filterId, query = {}) {
    await this.#ensureFilterExists(filterId);
    const pagination = parseListQuery(query, {
      allowedSortFields: [...FILTER_VALUE_SORT_FIELDS],
      defaultSort: DEFAULT_FILTER_VALUE_SORT,
    });
    const filter = this.filterValueRepository.buildListFilter(filterId, query);
    const { items, total } = await this.filterValueRepository.listByFilter(filter, {
      skip: pagination.skip,
      limit: pagination.limit,
      sort: pagination.sort,
    });
    return {
      items: items.map((v) => this.#sanitize(v)),
      meta: buildPaginationMeta(total, pagination),
    };
  }

  async createValue(filterId, data, actorId = null, file = null) {
    const group = await this.#ensureFilterExists(filterId);
    const payload = this.#normalizeNullable(data);
    payload.filterId = filterId;
    payload.slug = this.#resolveSlug(payload.label, payload.slug);
    await this.#assertValueSlugUnique(filterId, payload.slug);

    if (payload.isDefault && group.selectionType === FilterSelectionType.SINGLE) {
      await this.filterValueRepository.clearDefaults(filterId);
    }

    if (file) {
      payload.image = await this.#uploadImage(file);
    }

    if (actorId) {
      payload.createdBy = actorId;
      payload.updatedBy = actorId;
    }

    const created = await this.filterValueRepository.create(payload);
    await this.#invalidatePublicCache();
    return this.#sanitize(created);
  }

  async updateValue(filterId, valueId, data = {}, actorId = null, file = null) {
    const group = await this.#ensureFilterExists(filterId);
    const existing = await this.filterValueRepository.findActiveById(valueId, filterId);
    this.ensureFound(existing, 'Filter value not found');

    const payload = this.#normalizeNullable(data);
    if (!Object.keys(payload).length && !file) {
      throw new AppError(
        'No fields to update',
        HttpStatus.UNPROCESSABLE,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    if (payload.slug || payload.label) {
      payload.slug = this.#resolveSlug(payload.label || existing.label, payload.slug);
      await this.#assertValueSlugUnique(filterId, payload.slug, valueId);
    }

    if (payload.isDefault === true && group.selectionType === FilterSelectionType.SINGLE) {
      await this.filterValueRepository.clearDefaults(filterId, { exceptId: valueId });
    }

    if (file) {
      payload.image = await this.#uploadImage(file);
      await this.#deleteStoredImage(existing.image?.publicId);
    }

    if (actorId) payload.updatedBy = actorId;

    const updated = await this.filterValueRepository.updateById(valueId, payload);
    await this.#invalidatePublicCache();
    return this.#sanitize(this.ensureFound(updated, 'Filter value not found'));
  }

  async removeValue(filterId, valueId) {
    await this.#ensureFilterExists(filterId);
    const existing = await this.filterValueRepository.findActiveById(valueId, filterId);
    this.ensureFound(existing, 'Filter value not found');
    await this.filterValueRepository.softDelete(valueId, filterId);
    await this.#deleteStoredImage(existing.image?.publicId);
    await this.#invalidatePublicCache();
    return true;
  }

  async restoreValue(filterId, valueId) {
    await this.#ensureFilterExists(filterId);
    const existing = await this.filterValueRepository.findByIdAny(valueId, filterId);
    this.ensureFound(existing, 'Filter value not found');
    if (!existing.deletedAt) {
      throw new AppError(
        'Filter value is not deleted',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.BAD_REQUEST,
      );
    }
    await this.#assertValueSlugUnique(filterId, existing.slug, valueId);
    const restored = await this.filterValueRepository.restore(valueId, filterId);
    await this.#invalidatePublicCache();
    return this.#sanitize(restored);
  }

  async reorderValues(filterId, items = []) {
    await this.#ensureFilterExists(filterId);
    await this.filterValueRepository.reorder(filterId, items);
    await this.#invalidatePublicCache();
    return true;
  }

  async #ensureFilterExists(filterId) {
    const filter = await this.filterRepository.findActiveById(filterId);
    return this.ensureFound(filter, 'Filter not found');
  }
}
