import mongoose from 'mongoose';
import { CmsModel } from '../models/cms.model.js';

export class CmsRepository {
  async create(data) {
    const page = new CmsModel(data);
    return page.save();
  }

  async findById(id) {
    if (mongoose.Types.ObjectId.isValid(id)) {
      return CmsModel.findById(id);
    }
    return CmsModel.findOne({ slug: id });
  }

  async findWithPagination({ filter = {}, page = 1, limit = 25, sortBy = 'createdAt', sortOrder = 'desc' }) {
    const skip = (Math.max(1, page) - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [items, total] = await Promise.all([
      CmsModel.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true })
        .exec(),
      CmsModel.countDocuments(filter),
    ]);

    const formattedItems = items.map((c) => ({
      ...c,
      id: c._id?.toString(),
      name: c.title,
      status: c.status || 'PUBLISHED',
    }));

    return {
      items: formattedItems,
      total,
      page: Math.max(1, page),
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async update(id, data) {
    if (mongoose.Types.ObjectId.isValid(id)) {
      return CmsModel.findByIdAndUpdate(id, data, { new: true });
    }
    return CmsModel.findOneAndUpdate({ slug: id }, data, { new: true });
  }

  async delete(id) {
    if (mongoose.Types.ObjectId.isValid(id)) {
      return CmsModel.findByIdAndDelete(id);
    }
    return CmsModel.findOneAndDelete({ slug: id });
  }
}
