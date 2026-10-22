import mongoose from 'mongoose';
import { mediaSchema } from './media.schema.js';

const hygieneKitSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: null },
    price: { type: Number, required: true, min: 0, default: 49 },
    items: { type: [String], default: [] },
    thumbnail: { type: mediaSchema, default: () => ({ url: null, publicId: null }) },
    isDefault: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
    },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

hygieneKitSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const HygieneKitModel = mongoose.models.HygieneKit || mongoose.model('HygieneKit', hygieneKitSchema);
export default HygieneKitModel;
