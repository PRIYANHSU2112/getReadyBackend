import mongoose from 'mongoose';
import {
  MAX_CATEGORY_NAME_LENGTH,
  MAX_CATEGORY_SLUG_LENGTH,
  MAX_CATEGORY_DESCRIPTION_LENGTH,
} from '../../common/constants/category.js';

const priceRangeSchema = new mongoose.Schema(
  {
    min: { type: Number, default: null },
    max: { type: Number, default: null },
  },
  { _id: false },
);

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: MAX_CATEGORY_NAME_LENGTH,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: MAX_CATEGORY_SLUG_LENGTH,
    },
    description: {
      type: String,
      trim: true,
      default: null,
      maxlength: MAX_CATEGORY_DESCRIPTION_LENGTH,
    },
    image: {
      url: { type: String, trim: true, default: null },
      publicId: { type: String, trim: true, default: null },
    },
    icon: { type: String, trim: true, default: null },
    color: { type: String, trim: true, default: null },
    displayOrder: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false },
    defaultPriceRange: {
      type: priceRangeSchema,
      default: () => ({ min: null, max: null }),
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    deletedAt: { type: Date, default: null },
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
  },
  { timestamps: true },
);

categorySchema.pre('validate', function validatePriceRange(next) {
  const range = this.defaultPriceRange;
  if (
    range &&
    range.min != null &&
    range.max != null &&
    Number(range.min) > Number(range.max)
  ) {
    return next(new Error('defaultPriceRange.min must be <= defaultPriceRange.max'));
  }
  return next();
});

categorySchema.index({ deletedAt: 1, isActive: 1, displayOrder: 1 });
categorySchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
categorySchema.index({ deletedAt: 1, isActive: 1, isFeatured: 1, displayOrder: 1 });
categorySchema.index({ name: 'text' });

categorySchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const CategoryModel =
  mongoose.models.Category ||
  mongoose.model('Category', categorySchema, 'categories');

export default CategoryModel;
