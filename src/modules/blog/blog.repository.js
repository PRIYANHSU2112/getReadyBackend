import mongoose from 'mongoose';
import { BaseRepository } from '../../common/base/BaseRepository.js';
import { BlogStatus } from '../../common/constants/enums.js';
import {
  BLOG_LIST_SELECT,
  BLOG_DETAIL_SELECT,
  DEFAULT_BLOG_SORT,
} from '../../common/constants/blog.js';
import { buildSearchFilter } from '../../common/helpers/list-query.helper.js';

function toObjectId(id) {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  if (mongoose.isValidObjectId(id)) return new mongoose.Types.ObjectId(id);
  return null;
}

export class BlogRepository extends BaseRepository {
  constructor(model) {
    super(model);
  }

  async findByIdLean(id, { detail = false } = {}) {
    return this.findOne(
      { _id: id, deletedAt: null },
      { lean: true, select: detail ? BLOG_DETAIL_SELECT : BLOG_LIST_SELECT },
    );
  }

  async findBySlugLean(slug, { detail = false } = {}) {
    return this.findOne(
      { slug, deletedAt: null },
      { lean: true, select: detail ? BLOG_DETAIL_SELECT : BLOG_LIST_SELECT },
    );
  }

  async findPublishedByIdOrSlug(idOrSlug) {
    const filter = { deletedAt: null, status: BlogStatus.PUBLISHED };
    if (mongoose.isValidObjectId(idOrSlug)) {
      filter.$or = [{ _id: idOrSlug }, { slug: idOrSlug }];
    } else {
      filter.slug = idOrSlug;
    }
    return this.findOne(filter, { lean: true, select: BLOG_DETAIL_SELECT });
  }

  async findBySlug(slug, { excludeId = null } = {}) {
    const filter = { slug, deletedAt: null };
    if (excludeId) filter._id = { $ne: excludeId };
    return this.findOne(filter, { lean: true, select: '_id slug' });
  }

  buildAdminFilter(query = {}) {
    const filter = { deletedAt: null };
    if (query.status) filter.status = query.status;
    const categoryId = toObjectId(query.categoryId);
    if (categoryId) filter.categoryId = categoryId;
    if (query.isFeatured !== undefined) filter.isFeatured = query.isFeatured;
    const search = buildSearchFilter(query.search, ['title', 'excerpt', 'slug']);
    if (search) Object.assign(filter, search);
    return filter;
  }

  buildPublicFilter(query = {}) {
    const filter = { deletedAt: null, status: BlogStatus.PUBLISHED };
    const categoryId = toObjectId(query.categoryId);
    if (categoryId) filter.categoryId = categoryId;
    return filter;
  }

  async listAdmin(filter, options = {}) {
    return this.findAndCount(filter, {
      skip: options.skip ?? 0,
      limit: options.limit ?? 10,
      sort: options.sort || DEFAULT_BLOG_SORT,
      select: BLOG_LIST_SELECT,
    });
  }

  async listPublic(filter, options = {}) {
    return this.findAndCount(filter, {
      skip: options.skip ?? 0,
      limit: options.limit ?? 10,
      sort: options.sort || '-likesCount',
      select: BLOG_LIST_SELECT,
    });
  }

  /**
   * Latest hero: featured first, else newest published.
   */
  async findLatestPublished(categoryId = null) {
    const base = { deletedAt: null, status: BlogStatus.PUBLISHED };
    const catId = toObjectId(categoryId);
    if (catId) base.categoryId = catId;

    const featured = await this.model
      .findOne({ ...base, isFeatured: true })
      .sort({ publishedAt: -1 })
      .select(BLOG_LIST_SELECT)
      .lean()
      .exec();
    if (featured) return featured;

    return this.model
      .findOne(base)
      .sort({ publishedAt: -1 })
      .select(BLOG_LIST_SELECT)
      .lean()
      .exec();
  }

  async softDelete(id, updatedBy = null) {
    return this.model
      .findOneAndUpdate(
        { _id: id, deletedAt: null },
        {
          $set: {
            deletedAt: new Date(),
            status: BlogStatus.ARCHIVED,
            ...(updatedBy ? { updatedBy } : {}),
          },
        },
        { new: true },
      )
      .select(BLOG_LIST_SELECT)
      .lean()
      .exec();
  }

  async incrementLikes(id) {
    return this.model
      .findOneAndUpdate(
        { _id: id, deletedAt: null, status: BlogStatus.PUBLISHED },
        { $inc: { likesCount: 1 } },
        { new: true },
      )
      .select(BLOG_LIST_SELECT)
      .lean()
      .exec();
  }

  async incrementViews(id) {
    return this.model
      .updateOne({ _id: id, deletedAt: null }, { $inc: { viewCount: 1 } })
      .exec();
  }
}
