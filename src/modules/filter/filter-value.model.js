import mongoose from 'mongoose';
import { MAX_FILTER_SLUG_LENGTH } from '../../common/constants/filter.js';

const filterValueSchema = new mongoose.Schema(
  {
    filterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Filter',
      index: true,
    },
    label: { type: String, trim: true, required: true, maxlength: 100 },
    value: { type: String, trim: true, required: true, maxlength: 120 },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      maxlength: MAX_FILTER_SLUG_LENGTH,
    },
    icon: { type: String, trim: true, default: null },
    image: {
      url: { type: String, trim: true, default: null },
      publicId: { type: String, trim: true, default: null },
    },
    color: { type: String, trim: true, default: null },
    displayOrder: { type: Number, default: 0, min: 0 },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    deletedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

filterValueSchema.index({ filterId: 1, deletedAt: 1, isActive: 1, displayOrder: 1 });
filterValueSchema.index(
  { filterId: 1, slug: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

filterValueSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const FilterValueModel =
  mongoose.models.FilterValue ||
  mongoose.model('FilterValue', filterValueSchema, 'filter_values');

export default FilterValueModel;
