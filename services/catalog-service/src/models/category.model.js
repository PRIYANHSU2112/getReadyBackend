import mongoose from 'mongoose';
import { mediaSchema } from './media.schema.js';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, trim: true, default: null },
    image: { type: mediaSchema, default: () => ({ url: null, publicId: null }) },
    displayOrder: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

categorySchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const CategoryModel = mongoose.models.Category || mongoose.model('Category', categorySchema);
export default CategoryModel;
