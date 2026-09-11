import { NotFoundError, ValidationError } from '@getready/errors';

export class CmsService {
  constructor(cmsRepo, eventPublisher = null) {
    this.cmsRepo = cmsRepo;
    this.eventPublisher = eventPublisher;
  }

  async list(query = {}) {
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '25', 10), 100);
    const filter = {};

    if (query.status && query.status !== 'all' && query.status !== 'ALL') {
      filter.status = query.status.toUpperCase();
    }
    if (query.search && query.search.trim()) {
      const regex = new RegExp(query.search.trim(), 'i');
      filter.$or = [{ title: regex }, { slug: regex }];
    }

    return this.cmsRepo.findWithPagination({
      filter,
      page,
      limit,
      sortBy: query.sortBy || 'createdAt',
      sortOrder: query.sortOrder || 'desc',
    });
  }

  async getById(id) {
    const page = await this.cmsRepo.findById(id);
    if (!page) throw new NotFoundError('CMS page not found');
    return page;
  }

  async create(data) {
    const title = data.title || data.name;
    if (!title) throw new ValidationError('Title is required');
    const slug = (data.slug || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    return this.cmsRepo.create({
      title,
      slug,
      content: data.content || '<p>Content</p>',
      category: data.category || 'General',
      status: (data.status || 'PUBLISHED').toUpperCase(),
    });
  }

  async update(id, data) {
    const payload = { ...data };
    if (data.name && !data.title) payload.title = data.name;
    if (data.status) payload.status = data.status.toUpperCase();

    const page = await this.cmsRepo.update(id, payload);
    if (!page) throw new NotFoundError('CMS page not found');
    return page;
  }

  async delete(id) {
    const page = await this.cmsRepo.delete(id);
    if (!page) throw new NotFoundError('CMS page not found');
    return { id, deleted: true };
  }
}
