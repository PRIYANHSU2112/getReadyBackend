import { BaseRepository } from '../../common/base/BaseRepository.js';

export class UserRepository extends BaseRepository {
  constructor(userModel) {
    super(userModel);
  }

  async findByEmail(email, { includePassword = false } = {}) {
    let query = this.model.findOne({ email: email.toLowerCase(), deletedAt: null });
    if (includePassword) query = query.select('+password');
    return query.exec();
  }

  async findActiveById(id) {
    return this.findOne({ _id: id, deletedAt: null, isActive: true });
  }

  async search(filter, options) {
    return this.findAll({ ...filter, deletedAt: null }, options);
  }

  async countActive(filter = {}) {
    return this.count({ ...filter, deletedAt: null });
  }
}
