import { NotFoundError, ValidationError } from '@getready/errors';

export class SupportService {
  constructor(ticketRepo, eventPublisher = null) {
    this.ticketRepo = ticketRepo;
    this.eventPublisher = eventPublisher;
  }

  async list(query = {}) {
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '25', 10), 100);
    const filter = {};

    if (query.status && query.status !== 'all' && query.status !== 'ALL') {
      filter.status = query.status.toUpperCase();
    }
    if (query.priority && query.priority !== 'all') {
      filter.priority = query.priority.toUpperCase();
    }
    if (query.search && query.search.trim()) {
      const regex = new RegExp(query.search.trim(), 'i');
      filter.$or = [{ subject: regex }, { ticketNumber: regex }, { userName: regex }];
    }

    return this.ticketRepo.findWithPagination({
      filter,
      page,
      limit,
      sortBy: query.sortBy || 'createdAt',
      sortOrder: query.sortOrder || 'desc',
    });
  }

  async getById(id) {
    const ticket = await this.ticketRepo.findById(id);
    if (!ticket) throw new NotFoundError('Ticket not found');
    return ticket;
  }

  async create(data) {
    const subject = data.subject || data.name;
    if (!subject) throw new ValidationError('Subject is required');

    return this.ticketRepo.create({
      subject,
      description: data.description || null,
      priority: (data.priority || 'MEDIUM').toUpperCase(),
      status: (data.status || 'OPEN').toUpperCase(),
      userName: data.userName || 'Customer',
      userPhone: data.userPhone || null,
    });
  }

  async update(id, data) {
    const payload = { ...data };
    if (data.name && !data.subject) payload.subject = data.name;
    if (payload.status) payload.status = payload.status.toUpperCase();
    if (payload.priority) payload.priority = payload.priority.toUpperCase();

    const ticket = await this.ticketRepo.update(id, payload);
    if (!ticket) throw new NotFoundError('Ticket not found');
    return ticket;
  }

  async delete(id) {
    const ticket = await this.ticketRepo.delete(id);
    if (!ticket) throw new NotFoundError('Ticket not found');
    return { id, deleted: true };
  }
}
