import mongoose from 'mongoose';
import { BlogModel } from '../models/blog.model.js';

export class BlogRepository {
  async findPublished({ limit = 10, skip = 0, categoryId = null, sort = 'latest' } = {}) {
    const query = { status: 'PUBLISHED' };
    if (categoryId) query.categoryId = new mongoose.Types.ObjectId(categoryId);

    const sortOption = sort === 'popular' ? { likesCount: -1, publishedAt: -1 } : { publishedAt: -1 };

    const [blogs, total] = await Promise.all([
      BlogModel.find(query).sort(sortOption).skip(skip).limit(limit),
      BlogModel.countDocuments(query),
    ]);
    return { blogs, total };
  }

  async findHome() {
    const query = { status: 'PUBLISHED' };
    const latest = await BlogModel.find(query).sort({ publishedAt: -1 }).limit(1);
    const popular = await BlogModel.find(query).sort({ likesCount: -1 }).limit(5);
    return {
      hero: latest[0] || null,
      popular,
    };
  }

  async findByIdOrSlug(idOrSlug) {
    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      return BlogModel.findById(idOrSlug);
    }
    return BlogModel.findOne({ slug: idOrSlug });
  }

  async listManage({ limit = 20, skip = 0, status, categoryId } = {}) {
    const query = {};
    if (status) query.status = status;
    if (categoryId) query.categoryId = new mongoose.Types.ObjectId(categoryId);

    const [blogs, total] = await Promise.all([
      BlogModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      BlogModel.countDocuments(query),
    ]);
    return { blogs, total };
  }

  async create(data) {
    const doc = new BlogModel(data);
    return doc.save();
  }

  async update(id, data) {
    return BlogModel.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  async delete(id) {
    return BlogModel.findByIdAndUpdate(id, { status: 'ARCHIVED' }, { new: true });
  }

  async incrementLikes(id) {
    return BlogModel.findByIdAndUpdate(id, { $inc: { likesCount: 1 } }, { new: true });
  }
}
