import mongoose from 'mongoose';
import { mediaSchema } from './media.schema.js';

const packageItemSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    name: { type: String, trim: true, default: 'Service' },
    isMandatory: { type: Boolean, default: false },
    isDefaultSelected: { type: Boolean, default: true },
    extraCharge: { type: Number, default: 0, min: 0 },
    durationMinMinutes: { type: Number, default: 30 },
  },
  { _id: true },
);

const packageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    description: { type: String, trim: true, default: null },
    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, default: null, min: 0 },
    discountedPrice: { type: Number, default: null, min: 0 },
    minSelectCount: { type: Number, default: 1, min: 1 },
    maxSelectCount: { type: Number, default: 1, min: 1 },
    selectionNotice: { type: String, trim: true, default: null },
    durationMinMinutes: { type: Number, default: 60 },
    durationMaxMinutes: { type: Number, default: 90 },
    thumbnail: { type: mediaSchema, default: () => ({ url: null, publicId: null }) },
    images: { type: [mediaSchema], default: [] },
    badges: { type: [String], default: [] },
    items: { type: [packageItemSchema], default: [] },
    status: {
      type: String,
      enum: ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'],
      default: 'APPROVED',
      index: true,
    },
    rejectionReason: { type: String, trim: true, default: null },
    ratingAvg: { type: Number, default: 4.9, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    // Creator Beautician attribution for priority matching
    createdByBeauticianId: { type: String, default: null, index: true },
    createdByBeauticianName: { type: String, trim: true, default: null },
    isBeauticianCreated: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

packageSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const PackageModel = mongoose.models.Package || mongoose.model('Package', packageSchema);
export default PackageModel;
