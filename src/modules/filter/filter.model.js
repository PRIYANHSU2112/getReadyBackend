import mongoose from 'mongoose';
import {
  FilterDisplayType,
  FilterSelectionType,
} from '../../common/constants/enums.js';
import {
  MAX_FILTER_NAME_LENGTH,
  MAX_FILTER_SLUG_LENGTH,
  MAX_FILTER_SCOPES,
} from '../../common/constants/filter.js';

const filterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      maxlength: MAX_FILTER_NAME_LENGTH,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: MAX_FILTER_SLUG_LENGTH,
    },
    description: { type: String, trim: true, default: null, maxlength: 500 },
    displayType: {
      type: String,
      enum: Object.values(FilterDisplayType),
      default: FilterDisplayType.CHIPS,
      required: true,
    },
    selectionType: {
      type: String,
      enum: Object.values(FilterSelectionType),
      default: FilterSelectionType.MULTIPLE,
      required: true,
    },
    isSearchable: { type: Boolean, default: false },
    isRequired: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 0, min: 0 },
    icon: { type: String, trim: true, default: null },
    image: {
      url: { type: String, trim: true, default: null },
      publicId: { type: String, trim: true, default: null },
    },
    color: { type: String, trim: true, default: null },
    scopes: {
      type: [{ type: String, trim: true, lowercase: true }],
      default: [],
      validate: {
        validator(arr) {
          return !arr || arr.length <= MAX_FILTER_SCOPES;
        },
        message: `scopes cannot exceed ${MAX_FILTER_SCOPES} items`,
      },
    },
    metadata: { type: mongoose.Schema.Types.Mixed,  default: {} },
    deletedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

filterSchema.index({ deletedAt: 1, isActive: 1, displayOrder: 1 });
filterSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
filterSchema.index({ scopes: 1, deletedAt: 1, isActive: 1 });
filterSchema.index({ name: 1, deletedAt: 1 });

filterSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const FilterModel =
  mongoose.models.Filter || mongoose.model('Filter', filterSchema, 'filters');

export default FilterModel;
