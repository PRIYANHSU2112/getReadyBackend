import mongoose from 'mongoose';

const cmsSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, index: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    category: { type: String, trim: true, default: 'General' },
    status: {
      type: String,
      enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED', 'ACTIVE'],
      default: 'PUBLISHED',
      index: true,
    },
    metaTitle: { type: String, trim: true, default: null },
    metaDescription: { type: String, trim: true, default: null },
  },
  { timestamps: true },
);

cmsSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  obj.name = obj.title;
  obj.status = obj.status || 'PUBLISHED';
  return obj;
};

export const CmsModel = mongoose.models.Cms || mongoose.model('Cms', cmsSchema);
export default CmsModel;
