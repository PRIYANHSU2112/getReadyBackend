import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, required: true },
    description: { type: String, trim: true, default: null },
    imageUrl: { type: String, trim: true, required: true },
    deepLinkType: {
      type: String,
      enum: ['NONE', 'CATEGORY', 'SERVICE', 'PACKAGE', 'EXTERNAL_URL'],
      default: 'NONE',
    },
    deepLinkId: { type: String, trim: true, default: null },
    externalUrl: { type: String, trim: true, default: null },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
  },
  { timestamps: true },
);

bannerSchema.index({ isActive: 1, displayOrder: 1 });

bannerSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const BannerModel = mongoose.models.Banner || mongoose.model('Banner', bannerSchema);
export default BannerModel;
