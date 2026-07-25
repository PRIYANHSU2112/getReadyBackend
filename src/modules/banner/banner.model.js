import mongoose from 'mongoose';
import {
  BannerType,
  BannerStatus,
  BannerPlatform,
} from '../../common/constants/enums.js';
import {
  MIN_BANNER_POSITION,
  MAX_BANNER_POSITION,
} from '../../common/constants/banner.js';

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, maxlength: 200, required: true },
    image: {
      url: { type: String, trim: true, required: true },
      publicId: { type: String, trim: true, default: null },
    },
    linkUrl: { type: String, trim: true, default: null },
    position: {
      type: Number,
      required: true,
      min: MIN_BANNER_POSITION,
      max: MAX_BANNER_POSITION,
      index: true,
    },
    serviceCategory: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },
    serviceIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId }],
      default: [],
    },
    type: {
      type: String,
      enum: Object.values(BannerType),
      default: BannerType.GENERAL,
    },
    status: {
      type: String,
      enum: Object.values(BannerStatus),
      default: BannerStatus.INACTIVE,
      index: true,
    },
    sortOrder: { type: Number, default: 0, min: 0 },
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    platform: {
      type: String,
      enum: Object.values(BannerPlatform),
      default: BannerPlatform.ALL,
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

bannerSchema.index({ status: 1, deletedAt: 1, position: 1, sortOrder: 1 });
bannerSchema.index({ status: 1, deletedAt: 1, serviceCategory: 1, sortOrder: 1 });
bannerSchema.index({ status: 1, deletedAt: 1, serviceIds: 1 });
bannerSchema.index({ startAt: 1, endAt: 1 });

bannerSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const BannerModel =
  mongoose.models.Banner || mongoose.model('Banner', bannerSchema);

export default BannerModel;
