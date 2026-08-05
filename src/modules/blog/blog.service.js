import { BaseService } from '../../common/base/BaseService.js';
import { AppError } from '../../common/errors/AppError.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import { BlogStatus } from '../../common/constants/enums.js';
import {
  BLOG_CACHE_TTL_SECONDS,
  BLOG_WORDS_PER_MINUTE,
  DEFAULT_POPULAR_LIMIT,
  BLOG_SORT_FIELDS,
  DEFAULT_BLOG_SORT,
} from '../../common/constants/blog.js';
import { buildPaginationMeta } from '../../common/helpers/pagination.helper.js';
import { parseListQuery } from '../../common/helpers/list-query.helper.js';
import { TtlMemoryCache } from '../../core/cache/ttl-memory-cache.js';
import { RedisClient } from '../../core/redis/RedisClient.js';

const publicLocalCache = new TtlMemoryCache();

function slugify(title) {
  return String(title || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

function estimateReadTimeMin(content) {
  const words = String(content || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / BLOG_WORDS_PER_MINUTE));
}

export class BlogService extends BaseService {
  /**
   * @param {import('./blog.repository.js').BlogRepository} blogRepository
   * @param {import('../category/category.repository.js').CategoryRepository|null} categoryRepository
   * @param {import('../../core/redis/cache.service.js').CacheService|null} cacheService
   * @param {import('../../core/storage/StorageService.js').StorageService|null} storageService
   */
  constructor(
    blogRepository,
    categoryRepository = null,
    cacheService = null,
    storageService = null,
  ) {
    super(null, cacheService);
    this.blogRepository = blogRepository;
    this.categoryRepository = categoryRepository;
    this.storageService = storageService;
  }

  #sanitize(doc, { includeContent = false } = {}) {
    if (!doc) return doc;
    const obj = typeof doc.toJSON === 'function' ? doc.toJSON() : { ...doc };
    if (obj._id) obj.id = obj._id.toString();
    delete obj.__v;
    if (obj.categoryId) obj.categoryId = obj.categoryId.toString();
    if (obj.createdBy) obj.createdBy = obj.createdBy.toString();
    if (obj.updatedBy) obj.updatedBy = obj.updatedBy.toString();
    if (obj.coverImage?.url) obj.coverImageUrl = obj.coverImage.url;
    if (obj.thumbnail?.url) obj.thumbnailUrl = obj.thumbnail.url;
    if (!includeContent) delete obj.content;
    return obj;
  }

  #slimCategory(cat) {
    return {
      id: cat.id || cat._id?.toString(),
      name: cat.name,
      slug: cat.slug,
    };
  }

  async #invalidatePublicCache() {
    // Bust public read caches only — never `blog:liked:*` idempotency keys.
    const patterns = ['blog:home:', 'blog:list:', 'blog:detail:'];
    for (const key of [...publicLocalCache.store.keys()]) {
      if (patterns.some((p) => key.startsWith(p))) publicLocalCache.delSync(key);
    }
    if (this.cacheService?.delByPattern) {
      await Promise.all(patterns.map((p) => this.cacheService.delByPattern(`${p}*`)));
    }
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
    return { url: uploaded.url, publicId: uploaded.key };
  }

  async #deleteStoredImage(publicId) {
    if (!publicId || !this.storageService) return;
    try {
      await this.storageService.delete(publicId);
    } catch {
      // best-effort
    }
  }

  async #resolveCategory(categoryId) {
    if (!this.categoryRepository) {
      throw new AppError(
        'Category lookup is not configured',
        HttpStatus.INTERNAL_ERROR,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
    const category = await this.categoryRepository.findActiveById(categoryId);
    if (!category || category.isActive === false || category.deletedAt) {
      throw new AppError(
        'Category not found or inactive',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
      );
    }
    return category;
  }

  async #ensureUniqueSlug(slug, excludeId = null) {
    const existing = await this.blogRepository.findBySlug(slug, { excludeId });
    if (existing) {
      throw new AppError('Blog slug already exists', HttpStatus.CONFLICT, ErrorCodes.CONFLICT);
    }
  }

  #mapPublicSort(sort) {
    if (sort === 'popular' || sort === '-popular') return '-likesCount';
    if (sort === 'latest' || sort === '-latest') return '-publishedAt';
    return sort;
  }

  #withSecondarySort(sort) {
    if (sort === '-likesCount' || sort === 'likesCount') {
      return `${sort} -publishedAt`;
    }
    return sort;
  }

  async #loadCategoryChips() {
    if (!this.categoryRepository?.listPublicSlim) return [];
    const rows = await this.categoryRepository.listPublicSlim({});
    return rows.map((c) => this.#slimCategory(c));
  }

  async create(data, file = null, actorId = null) {
    const category = await this.#resolveCategory(data.categoryId);
    let slug = data.slug || slugify(data.title);
    if (!slug) {
      throw new AppError('Invalid slug', HttpStatus.UNPROCESSABLE, ErrorCodes.VALIDATION_ERROR);
    }
    await this.#ensureUniqueSlug(slug);

    const content = data.content || '';
    const status = data.status || BlogStatus.DRAFT;
    let publishedAt = data.publishedAt ? new Date(data.publishedAt) : null;
    if (status === BlogStatus.PUBLISHED && !publishedAt) {
      publishedAt = new Date();
    }

    const payload = {
      title: data.title,
      slug,
      excerpt: data.excerpt === '' ? null : data.excerpt ?? null,
      content,
      categoryId: category._id || category.id,
      categoryName: category.name,
      categorySlug: category.slug,
      status,
      isFeatured: Boolean(data.isFeatured),
      publishedAt,
      readTimeMin: data.readTimeMin || estimateReadTimeMin(content),
      authorName: data.authorName === '' ? null : data.authorName ?? null,
      likesCount: 0,
      viewCount: 0,
    };

    if (file) {
      payload.coverImage = await this.#uploadImage(file);
      payload.thumbnail = { ...payload.coverImage };
    } else if (data.coverImageUrl) {
      payload.coverImage = { url: data.coverImageUrl, publicId: null };
      payload.thumbnail = data.thumbnailUrl
        ? { url: data.thumbnailUrl, publicId: null }
        : { ...payload.coverImage };
    }

    if (actorId) {
      payload.createdBy = actorId;
      payload.updatedBy = actorId;
    }

    const created = await this.blogRepository.create(payload);
    await this.#invalidatePublicCache();
    return this.#sanitize(created, { includeContent: true });
  }

  async update(id, data, file = null, actorId = null) {
    const existing = await this.blogRepository.findByIdLean(id, { detail: true });
    this.ensureFound(existing, 'Blog not found');

    const payload = { ...data };
    delete payload.coverImageUrl;
    delete payload.thumbnailUrl;
    delete payload.file;

    if (payload.categoryId) {
      const category = await this.#resolveCategory(payload.categoryId);
      payload.categoryId = category._id || category.id;
      payload.categoryName = category.name;
      payload.categorySlug = category.slug;
    }

    if (payload.slug) {
      await this.#ensureUniqueSlug(payload.slug, id);
    }

    if (payload.excerpt === '') payload.excerpt = null;
    if (payload.authorName === '') payload.authorName = null;

    if (payload.content !== undefined && payload.readTimeMin === undefined) {
      payload.readTimeMin = estimateReadTimeMin(payload.content);
    }

    if (payload.status === BlogStatus.PUBLISHED) {
      if (!payload.publishedAt && !existing.publishedAt) {
        payload.publishedAt = new Date();
      } else if (payload.publishedAt) {
        payload.publishedAt = new Date(payload.publishedAt);
      }
    }

    if (file) {
      const uploaded = await this.#uploadImage(file);
      await this.#deleteStoredImage(existing.coverImage?.publicId);
      payload.coverImage = uploaded;
      if (!existing.thumbnail?.url || existing.thumbnail?.publicId === existing.coverImage?.publicId) {
        payload.thumbnail = { ...uploaded };
      }
    } else if (data.coverImageUrl) {
      payload.coverImage = { url: data.coverImageUrl, publicId: null };
    }
    if (data.thumbnailUrl) {
      payload.thumbnail = { url: data.thumbnailUrl, publicId: null };
    }

    if (actorId) payload.updatedBy = actorId;

    const updated = await this.blogRepository.updateById(id, payload);
    this.ensureFound(updated, 'Blog not found');
    await this.#invalidatePublicCache();
    return this.#sanitize(updated, { includeContent: true });
  }

  async remove(id, actorId = null) {
    const existing = await this.blogRepository.findByIdLean(id);
    this.ensureFound(existing, 'Blog not found');
    const deleted = await this.blogRepository.softDelete(id, actorId);
    this.ensureFound(deleted, 'Blog not found');
    await this.#invalidatePublicCache();
    return this.#sanitize(deleted);
  }

  async getByIdAdmin(id) {
    const blog = await this.blogRepository.findByIdLean(id, { detail: true });
    this.ensureFound(blog, 'Blog not found');
    return this.#sanitize(blog, { includeContent: true });
  }

  async listManage(query = {}) {
    const pagination = parseListQuery(query, {
      allowedSortFields: [...BLOG_SORT_FIELDS],
      defaultSort: DEFAULT_BLOG_SORT,
    });
    const filter = this.blogRepository.buildAdminFilter(query);
    const { items, total } = await this.blogRepository.listAdmin(filter, {
      skip: pagination.skip,
      limit: pagination.limit,
      sort: pagination.sort,
    });
    return {
      items: items.map((b) => this.#sanitize(b)),
      meta: buildPaginationMeta(total, pagination),
    };
  }

  async listPublic(query = {}) {
    const pagination = parseListQuery(
      { ...query, sort: this.#mapPublicSort(query.sort || 'popular') },
      {
        allowedSortFields: [...BLOG_SORT_FIELDS, 'likesCount'],
        defaultSort: '-likesCount',
      },
    );
    const cacheKey = this.cacheKey(
      'blog',
      'list',
      query.categoryId || 'all',
      pagination.page,
      pagination.limit,
      pagination.sort,
    );

    const local = publicLocalCache.getSync(cacheKey);
    if (local) return local;
    const cached = await this.getCached(cacheKey);
    if (cached) {
      publicLocalCache.setSync(cacheKey, cached, BLOG_CACHE_TTL_SECONDS);
      return cached;
    }

    const filter = this.blogRepository.buildPublicFilter(query);
    const { items, total } = await this.blogRepository.listPublic(filter, {
      skip: pagination.skip,
      limit: pagination.limit,
      sort: this.#withSecondarySort(pagination.sort),
    });
    const result = {
      items: items.map((b) => this.#sanitize(b)),
      meta: buildPaginationMeta(total, pagination),
    };
    publicLocalCache.setSync(cacheKey, result, BLOG_CACHE_TTL_SECONDS);
    await this.setCached(cacheKey, result, BLOG_CACHE_TTL_SECONDS);
    return result;
  }

  async getHome(query = {}) {
    const categoryId = query.categoryId || null;
    const popularLimit = Number(query.popularLimit) || DEFAULT_POPULAR_LIMIT;
    const page = Number(query.page) || 1;
    const cacheKey = this.cacheKey('blog', 'home', categoryId || 'all', page, popularLimit);

    const local = publicLocalCache.getSync(cacheKey);
    if (local) return local;
    const cached = await this.getCached(cacheKey);
    if (cached) {
      publicLocalCache.setSync(cacheKey, cached, BLOG_CACHE_TTL_SECONDS);
      return cached;
    }

    const [categories, latestDoc, popular] = await Promise.all([
      this.#loadCategoryChips(),
      this.blogRepository.findLatestPublished(categoryId),
      this.listPublic({
        categoryId: categoryId || undefined,
        sort: 'popular',
        page,
        limit: popularLimit,
      }),
    ]);

    // Avoid nested cache write race: listPublic already caches; home wraps it
    const result = {
      categories,
      latest: latestDoc ? this.#sanitize(latestDoc) : null,
      popular,
    };

    publicLocalCache.setSync(cacheKey, result, BLOG_CACHE_TTL_SECONDS);
    await this.setCached(cacheKey, result, BLOG_CACHE_TTL_SECONDS);
    return result;
  }

  async getPublicDetail(idOrSlug) {
    const cacheKey = this.cacheKey('blog', 'detail', idOrSlug);
    const local = publicLocalCache.getSync(cacheKey);
    if (local) {
      this.blogRepository.incrementViews(local.id).catch(() => {});
      return local;
    }
    const cached = await this.getCached(cacheKey);
    if (cached) {
      publicLocalCache.setSync(cacheKey, cached, BLOG_CACHE_TTL_SECONDS);
      this.blogRepository.incrementViews(cached.id).catch(() => {});
      return cached;
    }

    const blog = await this.blogRepository.findPublishedByIdOrSlug(idOrSlug);
    if (!blog) {
      throw new AppError('Blog not found', HttpStatus.NOT_FOUND, ErrorCodes.BLOG_NOT_FOUND);
    }
    const result = this.#sanitize(blog, { includeContent: true });
    publicLocalCache.setSync(cacheKey, result, BLOG_CACHE_TTL_SECONDS);
    await this.setCached(cacheKey, result, BLOG_CACHE_TTL_SECONDS);
    this.blogRepository.incrementViews(result.id).catch(() => {});
    return result;
  }

  /**
   * Idempotent like — Redis SET NX, fallback to cacheService.
   */
  async like(idOrSlug, userId) {
    const blog =
      (await this.blogRepository.findPublishedByIdOrSlug(idOrSlug)) ||
      (await this.blogRepository.findByIdLean(idOrSlug));
    if (!blog || blog.status !== BlogStatus.PUBLISHED) {
      throw new AppError('Blog not found', HttpStatus.NOT_FOUND, ErrorCodes.BLOG_NOT_FOUND);
    }

    const blogId = blog._id?.toString() || blog.id;
    const likeKey = this.cacheKey('blog', 'liked', blogId, String(userId));
    const claimed = await this.#claimLike(likeKey);
    if (!claimed) {
      return {
        liked: true,
        alreadyLiked: true,
        likesCount: blog.likesCount || 0,
        blog: this.#sanitize(blog),
      };
    }

    const updated = await this.blogRepository.incrementLikes(blogId);
    await this.#invalidatePublicCache();
    return {
      liked: true,
      alreadyLiked: false,
      likesCount: updated?.likesCount ?? (blog.likesCount || 0) + 1,
      blog: this.#sanitize(updated || blog),
    };
  }

  async #claimLike(likeKey) {
    try {
      const redis = RedisClient.getInstance();
      if (redis.isReady()) {
        const result = await redis.getClient().set(likeKey, '1', 'NX');
        return result === 'OK';
      }
    } catch {
      // fall through to cacheService
    }

    if (this.cacheService) {
      const existing = await this.cacheService.get(likeKey);
      if (existing) return false;
      await this.cacheService.set(likeKey, true, 0);
      return true;
    }
    return true;
  }
}
