import { NotFoundError, ValidationError } from '@getready/errors';

export class ReviewService {
  constructor(reviewRepo, eventPublisher = null) {
    this.reviewRepo = reviewRepo;
    this.eventPublisher = eventPublisher;
  }

  async list(query = {}) {
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '25', 10), 100);
    const filter = {};

    if (query.status && query.status !== 'all' && query.status !== 'ALL') {
      filter.status = query.status.toUpperCase();
    }
    if (query.rating) {
      filter.rating = Number(query.rating);
    }
    if (query.search && query.search.trim()) {
      const regex = new RegExp(query.search.trim(), 'i');
      filter.$or = [{ title: regex }, { comment: regex }, { serviceName: regex }];
    }

    return this.reviewRepo.findWithPagination({
      filter,
      page,
      limit,
      sortBy: query.sortBy || 'createdAt',
      sortOrder: query.sortOrder || 'desc',
    });
  }

  async getById(id) {
    const review = await this.reviewRepo.findById(id);
    if (!review) throw new NotFoundError('Review not found');
    return review;
  }

  async create(data) {
    const rating = Number(data.rating || 5);
    const title = data.title || data.name || `${rating}★ Review`;

    return this.reviewRepo.create({
      title,
      comment: data.comment || data.description || null,
      rating,
      serviceName: data.service || data.serviceName || 'Beauty Care Service',
      userName: data.userName || 'Customer',
      status: (data.status || 'APPROVED').toUpperCase(),
    });
  }

  async update(id, data) {
    const payload = { ...data };
    if (data.name && !data.title) payload.title = data.name;
    if (data.rating) payload.rating = Number(data.rating);
    if (data.status) payload.status = data.status.toUpperCase();

    const review = await this.reviewRepo.update(id, payload);
    if (!review) throw new NotFoundError('Review not found');
    return review;
  }

  async delete(id) {
    const review = await this.reviewRepo.delete(id);
    if (!review) throw new NotFoundError('Review not found');
    return { id, deleted: true };
  }

  async getAdminStats(query = {}) {
    let startDate = query.startDate;
    let endDate = query.endDate;

    if (query.period && !startDate) {
      const now = new Date();
      if (query.period === 'today') {
        startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      } else if (query.period === 'week') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        startDate = d.toISOString();
      } else if (query.period === 'month') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        startDate = d.toISOString();
      }
    }

    return this.reviewRepo.getAdminStats({
      startDate,
      endDate,
      serviceId: query.serviceId,
      beauticianId: query.beauticianId,
    });
  }
}
