import mongoose from 'mongoose';
import { BlogStatus } from '../../common/constants/enums.js';
import {
  MAX_BLOG_TITLE_LENGTH,
  MAX_BLOG_SLUG_LENGTH,
  MAX_BLOG_EXCERPT_LENGTH,
  MAX_BLOG_CONTENT_LENGTH,
  MAX_BLOG_AUTHOR_NAME_LENGTH,
} from '../../common/constants/blog.js';

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, default: null },
    publicId: { type: String, trim: true, default: null },
  },
  { _id: false },
);

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: MAX_BLOG_TITLE_LENGTH,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: MAX_BLOG_SLUG_LENGTH,
    },
    excerpt: {
      type: String,
      trim: true,
      default: null,
      maxlength: MAX_BLOG_EXCERPT_LENGTH,
    },
    content: {
      type: String,
      trim: true,
      default: '',
      maxlength: MAX_BLOG_CONTENT_LENGTH,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    categoryName: { type: String, trim: true, default: null },
    categorySlug: { type: String, trim: true, lowercase: true, default: null },
    coverImage: { type: imageSchema, default: () => ({ url: null, publicId: null }) },
    thumbnail: { type: imageSchema, default: () => ({ url: null, publicId: null }) },
    status: {
      type: String,
      enum: Object.values(BlogStatus),
      default: BlogStatus.DRAFT,
      index: true,
    },
    isFeatured: { type: Boolean, default: false, index: true },
    publishedAt: { type: Date, default: null, index: true },
    readTimeMin: { type: Number, default: 1, min: 1 },
    likesCount: { type: Number, default: 0, min: 0 },
    viewCount: { type: Number, default: 0, min: 0 },
    authorName: {
      type: String,
      trim: true,
      default: null,
      maxlength: MAX_BLOG_AUTHOR_NAME_LENGTH,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

blogSchema.index({ slug: 1 }, { unique: true });
blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ status: 1, categoryId: 1, likesCount: -1 });
blogSchema.index({ isFeatured: 1, status: 1, publishedAt: -1 });
blogSchema.index({ deletedAt: 1, status: 1 });

blogSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const BlogModel = mongoose.models.Blog || mongoose.model('Blog', blogSchema);

export default BlogModel;
