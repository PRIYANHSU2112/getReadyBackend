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

  /**
   * Single round-trip list + total via $facet.
   * @param {object} filter
   * @param {{ skip?: number, limit?: number, sort?: string|object, select?: string }} options
   * @returns {Promise<{ items: object[], total: number }>}
   */
  async findAndCount(filter = {}, options = {}) {
    const { skip = 0, limit = 10, sort = '-createdAt', select } = options;
    const sortObj = this.#toSortObject(sort);
    const project = this.#toProjectObject(select);

    const itemsStage = [
      { $sort: Object.keys(sortObj).length ? sortObj : { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ];
    if (project) itemsStage.push({ $project: project });

    const [result] = await this.model
      .aggregate([
        { $match: filter },
        {
          $facet: {
            items: itemsStage,
            total: [{ $count: 'n' }],
          },
        },
      ])
      .exec();

    return {
      items: result?.items || [],
      total: result?.total?.[0]?.n || 0,
    };
  }

  #toSortObject(sort) {
    if (!sort) return { createdAt: -1 };
    if (typeof sort === 'object') return sort;
    const out = {};
    for (const part of String(sort).split(/\s+/).filter(Boolean)) {
      if (part.startsWith('-')) out[part.slice(1)] = -1;
      else out[part] = 1;
    }
    return out;
  }

  #toProjectObject(select) {
    if (!select) return null;
    const project = {};
    for (const part of String(select).split(/\s+/).filter(Boolean)) {
      if (part.startsWith('-')) project[part.slice(1)] = 0;
      else project[part] = 1;
    }
    return Object.keys(project).length ? project : null;
  }

  async updateById(id, data, options = { new: true, runValidators: true }) {
    return this.model.findByIdAndUpdate(id, { $set: data }, options).lean().exec();
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
