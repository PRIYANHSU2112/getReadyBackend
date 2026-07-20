export class BaseRepository {
  /**
   * @param {import('mongoose').Model} model
   */
  constructor(model) {
    this.model = model;
  }

  async create(data) {
    return this.model.create(data);
  }

  async findById(id, options = {}) {
    let query = this.model.findById(id);
    if (options.lean !== false) query = query.lean();
    if (options.select) query = query.select(options.select);
    return query.exec();
  }

  async findOne(filter = {}, options = {}) {
    let query = this.model.findOne(filter);
    if (options.lean !== false) query = query.lean();
    if (options.select) query = query.select(options.select);
    return query.exec();
  }

  /**
   * @param {object} filter
   * @param {{ skip?: number, limit?: number, sort?: string|object, lean?: boolean, select?: string }} options
   */
  async findAll(filter = {}, options = {}) {
    const { skip = 0, limit = 10, sort = '-createdAt', lean = true, select } = options;
    let query = this.model.find(filter).sort(sort).skip(skip).limit(limit);
    if (lean) query = query.lean();
    if (select) query = query.select(select);
    return query.exec();
  }

  async count(filter = {}) {
    return this.model.countDocuments(filter);
  }

  async updateById(id, data, options = { new: true, runValidators: true }) {
    return this.model.findByIdAndUpdate(id, data, options).lean().exec();
  }

  async softDelete(id) {
    return this.model
      .findByIdAndUpdate(id, { deletedAt: new Date(), isActive: false }, { new: true })
      .lean()
      .exec();
  }

  async deleteById(id) {
    return this.model.findByIdAndDelete(id).lean().exec();
  }
}
