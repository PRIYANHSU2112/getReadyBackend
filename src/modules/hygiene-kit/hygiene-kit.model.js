import mongoose from 'mongoose';
import { HygieneKitStatus } from '../../common/constants/enums.js';
import {
  DEFAULT_HYGIENE_KIT_PRICE,
  MIN_HYGIENE_KIT_PRICE,
  MAX_HYGIENE_KIT_PRICE,
  DEFAULT_HYGIENE_KIT_MIN_QTY,
  DEFAULT_HYGIENE_KIT_MAX_QTY,
  MAX_HYGIENE_KIT_TITLE_LENGTH,
  MAX_HYGIENE_KIT_CODE_LENGTH,
  MAX_HYGIENE_KIT_DESCRIPTION_LENGTH,
} from '../../common/constants/hygiene-kit.js';

const includedItemSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    quantity: { type: Number, default: 1, min: 1 },
    icon: { type: String, trim: true, default: null },
    description: { type: String, trim: true, default: null },
  },
  { _id: false },
);

const hygieneKitSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      maxlength: MAX_HYGIENE_KIT_TITLE_LENGTH,
      required: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: MAX_HYGIENE_KIT_CODE_LENGTH,
      unique: true,
      sparse: true,
      default: null,
    },
    price: {
      type: Number,
      required: true,
      default: DEFAULT_HYGIENE_KIT_PRICE,
      min: MIN_HYGIENE_KIT_PRICE,
      max: MAX_HYGIENE_KIT_PRICE,
    },
    description: {
      type: String,
      trim: true,
      maxlength: MAX_HYGIENE_KIT_DESCRIPTION_LENGTH,
      default: null,
    },
    includedItems: {
      type: [includedItemSchema],
      default: [],
    },
    image: {
      url: { type: String, trim: true, default: null },
      publicId: { type: String, trim: true, default: null },
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
    isRequired: {
      type: Boolean,
      default: true,
    },
    minQuantity: {
      type: Number,
      default: DEFAULT_HYGIENE_KIT_MIN_QTY,
      min: 1,
    },
    maxQuantity: {
      type: Number,
      default: DEFAULT_HYGIENE_KIT_MAX_QTY,
      min: 1,
    },
    status: {
      type: String,
      enum: Object.values(HygieneKitStatus),
      default: HygieneKitStatus.ACTIVE,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Performance & Filtering Compound Indexes
hygieneKitSchema.index({ status: 1, deletedAt: 1, isDefault: 1 });
hygieneKitSchema.index({ status: 1, deletedAt: 1, sortOrder: 1, createdAt: -1 });

hygieneKitSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const HygieneKitModel =
  mongoose.models.HygieneKit || mongoose.model('HygieneKit', hygieneKitSchema);

export default HygieneKitModel;
