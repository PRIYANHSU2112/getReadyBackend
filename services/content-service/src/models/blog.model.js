import mongoose from 'mongoose';

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, required: true },
    slug: { type: String, trim: true, unique: true, index: true },
    summary: { type: String, trim: true, default: '' },
    content: { type: String, required: true },
    coverImageUrl: { type: String, trim: true, default: null },
    authorName: { type: String, trim: true, default: 'GetReady Team' },
    tags: { type: [String], default: [] },
    categoryId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    status: {
      type: String,
      enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
      default: 'DRAFT',
      index: true,
    },
    likesCount: { type: Number, default: 0, min: 0 },
    readTimeMinutes: { type: Number, default: 3, min: 1 },
    publishedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

blogSchema.index({ status: 1, publishedAt: -1 });

blogSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const BlogModel = mongoose.models.Blog || mongoose.model('Blog', blogSchema);
export default BlogModel;
