import mongoose from 'mongoose';
import { mediaSchema } from './media.schema.js';

const serviceSchema = new mongoose.Schema(
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
    shortDescription: { type: String, trim: true, default: null },
    price: { type: Number, required: true, min: 0 },
    discountedPrice: { type: Number, default: null, min: 0 },
    durationMinMinutes: { type: Number, default: 30, min: 5 },
    durationMaxMinutes: { type: Number, default: 45, min: 5 },
    homeVisitFee: { type: Number, default: 0, min: 0 },
    thumbnail: { type: mediaSchema, default: () => ({ url: null, publicId: null }) },
    images: { type: [mediaSchema], default: [] },
    badges: { type: [String], default: [] },
    gender: { type: String, enum: ['all', 'female', 'male', 'unisex'], default: 'all' },
    status: {
      type: String,
      enum: ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'],
      default: 'APPROVED',
      index: true,
    },
    rejectionReason: { type: String, trim: true, default: null },
    ratingAvg: { type: Number, default: 4.8, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    displayOrder: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
    // Creator Beautician attribution for priority matching
    createdByBeauticianId: { type: String, default: null, index: true },
    createdByBeauticianName: { type: String, trim: true, default: null },
    isBeauticianCreated: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

serviceSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const ServiceModel = mongoose.models.Service || mongoose.model('Service', serviceSchema);
export default ServiceModel;
