import { BaseRepository } from '../../common/base/BaseRepository.js';
import {
  buildSearchFilter,
} from '../../common/helpers/list-query.helper.js';

export class RoleRepository extends BaseRepository {
  constructor(roleModel) {
    super(roleModel);
  }

  async findBySlug(slug, { lean = true, select } = {}) {
    if (!slug) return null;
    return this.findOne({ slug: slug.toLowerCase().trim() }, { lean, select });
  }

  async findActiveBySlug(slug) {
    if (!slug) return null;
    return this.findOne({ slug: slug.toLowerCase().trim(), isActive: true }, { lean: true });
  }

  buildListFilter(query = {}) {
    const filter = {};
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    if (query.isSystem !== undefined) filter.isSystem = query.isSystem;

    const searchFilter = buildSearchFilter(query.search, ['name', 'slug', 'description']);
    if (searchFilter) {
      filter.$and = filter.$and || [];
      filter.$and.push(searchFilter);
    }
    return filter;
  }

  async search(filter, options) {
    return this.findAll(filter, {
      ...options,
      lean: true,
      select: options.select || '-__v',
    });
  }

  async searchAndCount(filter, options) {
    return this.findAndCount(filter, {
      ...options,
      select: options.select || '-__v',
    });
  }

  async upsertBySlug(data) {
    return this.model
      .findOneAndUpdate(
        { slug: data.slug },
        {
          $set: {
            name: data.name,
            description: data.description ?? '',
            permissions: data.permissions ?? [],
            isSystem: data.isSystem ?? false,
            isSuperAdmin: data.isSuperAdmin ?? false,
            isActive: data.isActive !== false,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .lean()
      .exec();
  }
}
