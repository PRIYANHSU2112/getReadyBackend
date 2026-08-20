import { BaseService } from '../../common/base/BaseService.js';
import { AppError } from '../../common/errors/AppError.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import {
  HYGIENE_KIT_CACHE_TTL_SECONDS,
  HYGIENE_KIT_SORT_FIELDS,
  DEFAULT_HYGIENE_KIT_SORT,
} from '../../common/constants/hygiene-kit.js';
import { HygieneKitStatus } from '../../common/constants/enums.js';
import { buildPaginationMeta } from '../../common/helpers/pagination.helper.js';
import { parseListQuery } from '../../common/helpers/list-query.helper.js';
import { TtlMemoryCache } from '../../core/cache/ttl-memory-cache.js';

const activeLocalCache = new TtlMemoryCache();

export class HygieneKitService extends BaseService {
  /**
   * @param {import('./hygiene-kit.repository.js').HygieneKitRepository} hygieneKitRepository
   * @param {import('../../core/redis/cache.service.js').CacheService|null} cacheService
   * @param {import('../../core/storage/StorageService.js').StorageService|null} storageService
   */
  constructor(hygieneKitRepository, cacheService = null, storageService = null) {
    super(null, cacheService);
    this.hygieneKitRepository = hygieneKitRepository;
    this.storageService = storageService;
  }

  #sanitize(kit) {
    if (!kit) return null;
    const obj = typeof kit.toJSON === 'function' ? kit.toJSON() : { ...kit };
    if (obj._id) obj.id = obj._id.toString();
    if (obj.image?.url) {
      obj.imageUrl = obj.image.url;
    }
    return obj;
  }

  #normalizeIncludedItems(items) {
    if (!items) return undefined;
    let parsed = items;
    if (typeof items === 'string') {
      try {
        parsed = JSON.parse(items);
      } catch {
        parsed = items.split(',').map((s) => ({ name: s.trim() }));
      }
    }
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item) => {
      if (typeof item === 'string') {
        return { name: item.trim(), quantity: 1 };
      }
      return {
        name: item.name?.trim?.() || String(item),
        quantity: Number(item.quantity) || 1,
        icon: item.icon?.trim?.() || null,
        description: item.description?.trim?.() || null,
      };
    });
  }

  #normalizePayload(data = {}) {
    const payload = { ...data };
    delete payload.imageUrl;
    delete payload.image;
    delete payload.file;

    if (payload.code) {
      payload.code = payload.code.trim().toUpperCase();
    }
    if (payload.price !== undefined) {
      payload.price = Number(payload.price);
    }
    if (payload.minQuantity !== undefined) {
      payload.minQuantity = Number(payload.minQuantity);
    }
    if (payload.maxQuantity !== undefined) {
      payload.maxQuantity = Number(payload.maxQuantity);
    }
    if (payload.sortOrder !== undefined) {
      payload.sortOrder = Number(payload.sortOrder);
    }
    if (payload.isDefault !== undefined) {
      payload.isDefault =
        payload.isDefault === true ||
        payload.isDefault === 'true' ||
        payload.isDefault === 1 ||
        payload.isDefault === '1';
    }
    if (payload.isRequired !== undefined) {
      payload.isRequired =
        payload.isRequired === true ||
        payload.isRequired === 'true' ||
        payload.isRequired === 1 ||
        payload.isRequired === '1';
    }
    if (payload.includedItems !== undefined) {
      payload.includedItems = this.#normalizeIncludedItems(payload.includedItems);
    }

    return payload;
  }

  async #uploadImage(file) {
    if (!file) return null;
    if (!this.storageService) {
      return { url: `/uploads/hygiene-kits/${file.originalname}`, publicId: null };
    }
    const uploaded = await this.storageService.upload(file, 'hygiene-kits');
    return {
      url: uploaded.url || uploaded.secure_url || uploaded.Location,
      publicId: uploaded.public_id || uploaded.key || null,
    };
  }

  async #deleteImage(publicId) {
    if (!publicId || !this.storageService) return;
    try {
      if (typeof this.storageService.delete === 'function') {
        await this.storageService.delete(publicId);
      }
    } catch {
      // Non-critical image deletion error logged/ignored
    }
  }

  #activeCacheKey(pagination) {
    return this.cacheKey(
      'hygiene_kit',
      'active',
      pagination.page,
      pagination.limit,
      pagination.sort,
    );
  }

  #defaultCacheKey() {
    return this.cacheKey('hygiene_kit', 'default');
  }

  async #invalidateCache() {
    const activePrefix = this.cacheKey('hygiene_kit', 'active');
    const defaultKey = this.#defaultCacheKey();

    for (const key of [...activeLocalCache.store.keys()]) {
      if (key.startsWith(activePrefix) || key === defaultKey) {
        activeLocalCache.delSync(key);
      }
    }
    if (this.cacheService?.delByPattern) {
      await this.cacheService.delByPattern(`${activePrefix}*`);
      await this.cacheService.del(defaultKey);
    } else if (this.cacheService?.del) {
      await this.cacheService.del(defaultKey);
    }
  }

  /**
   * Fetch active default hygiene kit (Mandatory ₹49 kit for cart / info sheet).
   */
  async getDefaultKit() {
    const cacheKey = this.#defaultCacheKey();
    const local = activeLocalCache.getSync(cacheKey);
    if (local) return local;

    const cached = await this.getCached(cacheKey);
    if (cached) {
      activeLocalCache.setSync(cacheKey, cached, HYGIENE_KIT_CACHE_TTL_SECONDS);
      return cached;
    }

    const kit = await this.hygieneKitRepository.findDefaultActive();
    if (!kit) {
      return null;
    }

    const sanitized = this.#sanitize(kit);
    activeLocalCache.setSync(cacheKey, sanitized, HYGIENE_KIT_CACHE_TTL_SECONDS);
    await this.setCached(cacheKey, sanitized, HYGIENE_KIT_CACHE_TTL_SECONDS);
    return sanitized;
  }

  /**
   * Public list of all active hygiene kits.
   */
  async listActive(query = {}) {
    const pagination = parseListQuery(query, {
      allowedSortFields: [...HYGIENE_KIT_SORT_FIELDS],
      defaultSort: DEFAULT_HYGIENE_KIT_SORT,
    });
    const cacheKey = this.#activeCacheKey(pagination);

    const local = activeLocalCache.getSync(cacheKey);
    if (local) return local;

    const cached = await this.getCached(cacheKey);
    if (cached) {
      activeLocalCache.setSync(cacheKey, cached, HYGIENE_KIT_CACHE_TTL_SECONDS);
      return cached;
    }

    const { items, total } = await this.hygieneKitRepository.listActivePublic(
      {},
      {
        skip: pagination.skip,
        limit: pagination.limit,
        sort: pagination.sort,
      },
    );

    const result = {
      items: items.map((k) => this.#sanitize(k)),
      meta: buildPaginationMeta(total, pagination),
    };

    activeLocalCache.setSync(cacheKey, result, HYGIENE_KIT_CACHE_TTL_SECONDS);
    await this.setCached(cacheKey, result, HYGIENE_KIT_CACHE_TTL_SECONDS);
    return result;
  }

  /**
   * Admin paginated list of all hygiene kits.
   */
  async list(query = {}) {
    const pagination = parseListQuery(query, {
      allowedSortFields: [...HYGIENE_KIT_SORT_FIELDS],
      defaultSort: DEFAULT_HYGIENE_KIT_SORT,
    });
    const filter = this.hygieneKitRepository.buildAdminFilter(query);
    const { items, total } = await this.hygieneKitRepository.listAdmin(filter, {
      skip: pagination.skip,
      limit: pagination.limit,
      sort: pagination.sort,
    });

    return {
      items: items.map((k) => this.#sanitize(k)),
      meta: buildPaginationMeta(total, pagination),
    };
  }

  /**
   * Get single hygiene kit by ID (admin/public).
   */
  async getById(id) {
    const kit = await this.hygieneKitRepository.findById(id);
    return this.#sanitize(this.ensureFound(kit, 'Hygiene kit not found'));
  }

  /**
   * Create new hygiene kit.
   */
  async create(data, file = null) {
    const payload = this.#normalizePayload(data);

    if (payload.code) {
      const existingCode = await this.hygieneKitRepository.findByCode(payload.code);
      if (existingCode) {
        throw new AppError(
          `Hygiene kit with code '${payload.code}' already exists`,
          HttpStatus.CONFLICT,
          ErrorCodes.RESOURCE_ALREADY_EXISTS,
        );
      }
    }

    if (file) {
      payload.image = await this.#uploadImage(file);
    }

    const created = await this.hygieneKitRepository.create(payload);

    if (payload.isDefault) {
      await this.hygieneKitRepository.clearOtherDefaults(created._id);
    }

    await this.#invalidateCache();
    return this.#sanitize(created);
  }

  /**
   * Update hygiene kit.
   */
  async update(id, data = {}, file = null) {
    const existing = await this.hygieneKitRepository.findById(id);
    this.ensureFound(existing, 'Hygiene kit not found');

    const payload = this.#normalizePayload(data);

    if (payload.code && payload.code !== existing.code) {
      const existingCode = await this.hygieneKitRepository.findByCode(payload.code);
      if (existingCode && existingCode._id.toString() !== id) {
        throw new AppError(
          `Hygiene kit with code '${payload.code}' already exists`,
          HttpStatus.CONFLICT,
          ErrorCodes.RESOURCE_ALREADY_EXISTS,
        );
      }
    }

    if (file) {
      if (existing.image?.publicId) {
        await this.#deleteImage(existing.image.publicId);
      }
      payload.image = await this.#uploadImage(file);
    }

    const updated = await this.hygieneKitRepository.updateById(id, payload);

    if (payload.isDefault) {
      await this.hygieneKitRepository.clearOtherDefaults(id);
    }

    await this.#invalidateCache();
    return this.#sanitize(updated);
  }

  /**
   * Set specific kit as the system default.
   */
  async setDefault(id) {
    const existing = await this.hygieneKitRepository.findById(id);
    this.ensureFound(existing, 'Hygiene kit not found');

    if (existing.status !== HygieneKitStatus.ACTIVE) {
      throw new AppError(
        'Cannot set an inactive hygiene kit as default',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    await this.hygieneKitRepository.clearOtherDefaults(id);
    const updated = await this.hygieneKitRepository.updateById(id, {
      isDefault: true,
    });

    await this.#invalidateCache();
    return this.#sanitize(updated);
  }

  /**
   * Update status (ACTIVE / INACTIVE).
   */
  async setStatus(id, status) {
    const existing = await this.hygieneKitRepository.findById(id);
    this.ensureFound(existing, 'Hygiene kit not found');

    if (status === HygieneKitStatus.INACTIVE && existing.isDefault) {
      throw new AppError(
        'Cannot deactivate the default hygiene kit. Set another kit as default first.',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    const updated = await this.hygieneKitRepository.updateById(id, { status });
    await this.#invalidateCache();
    return this.#sanitize(updated);
  }

  /**
   * Soft delete hygiene kit.
   */
  async remove(id) {
    const existing = await this.hygieneKitRepository.findById(id);
    this.ensureFound(existing, 'Hygiene kit not found');

    if (existing.isDefault) {
      throw new AppError(
        'Cannot delete the default hygiene kit. Designate another kit as default first.',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    const deleted = await this.hygieneKitRepository.softDelete(id);
    await this.#invalidateCache();
    return this.#sanitize(deleted);
  }

  /**
   * Restore soft-deleted hygiene kit.
   */
  async restore(id) {
    const restored = await this.hygieneKitRepository.restore(id);
    this.ensureFound(restored, 'Hygiene kit not found or not deleted');
    await this.#invalidateCache();
    return this.#sanitize(restored);
  }
}
