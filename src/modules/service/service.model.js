import mongoose from 'mongoose';
import {
  ServiceDiscountType,
  ServiceStatus,
  ServiceBadge,
  ServiceGender,
} from '../../common/constants/enums.js';
import {
  MAX_SERVICE_NAME_LENGTH,
  MAX_SERVICE_SLUG_LENGTH,
  MAX_SERVICE_SHORT_DESCRIPTION_LENGTH,
  MAX_SERVICE_DESCRIPTION_LENGTH,
  MAX_SERVICE_IMAGES,
  MAX_SERVICE_TAGS,
  MAX_SERVICE_INCLUSIONS,
} from '../../common/constants/service.js';

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, default: null },
    publicId: { type: String, trim: true, default: null },
  },
  { _id: false },
);

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, required: true },
    publicId: { type: String, trim: true, default: null },
    isPrimary: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const inclusionSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, required: true, maxlength: 200 },
    displayOrder: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: MAX_SERVICE_NAME_LENGTH,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: MAX_SERVICE_SLUG_LENGTH,
    },
    shortDescription: {
      type: String,
      trim: true,
      default: null,
      maxlength: MAX_SERVICE_SHORT_DESCRIPTION_LENGTH,
    },
    description: {
      type: String,
      trim: true,
      default: null,
      maxlength: MAX_SERVICE_DESCRIPTION_LENGTH,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    images: {
      type: [imageSchema],
      default: [],
      validate: {
        validator(arr) {
          return !arr || arr.length <= MAX_SERVICE_IMAGES;
        },
        message: `images cannot exceed ${MAX_SERVICE_IMAGES}`,
      },
    },
    thumbnail: { type: mediaSchema, default: () => ({ url: null, publicId: null }) },
    video: { type: mediaSchema, default: () => ({ url: null, publicId: null }) },
    durationMinMinutes: { type: Number, default: null, min: 0 },
    durationMaxMinutes: { type: Number, default: null, min: 0 },
    price: { type: Number, default: null, min: 0 },
    discountType: {
      type: String,
      enum: Object.values(ServiceDiscountType),
      default: ServiceDiscountType.NONE,
    },
    discountValue: { type: Number, default: 0, min: 0 },
    discountedPrice: { type: Number, default: null, min: 0 },
    approxPrice: { type: Number, default: null, min: 0 },
    badges: {
      type: [
        {
          type: String,
          enum: Object.values(ServiceBadge),
        },
      ],
      default: [],
    },
    isPopular: { type: Boolean, default: false },
    isTrending: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    inclusions: {
      type: [inclusionSchema],
      default: [],
      validate: {
        validator(arr) {
          return !arr || arr.length <= MAX_SERVICE_INCLUSIONS;
        },
        message: `inclusions cannot exceed ${MAX_SERVICE_INCLUSIONS}`,
      },
    },
    isHomeServiceAvailable: { type: Boolean, default: false },
    homeVisitFee: { type: Number, default: 0, min: 0 },
    rewardPointsMultiplier: { type: Number, default: 1, min: 0 },
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    tags: {
      type: [{ type: String, trim: true, lowercase: true, maxlength: 50 }],
      default: [],
      validate: {
        validator(arr) {
          return !arr || arr.length <= MAX_SERVICE_TAGS;
        },
        message: `tags cannot exceed ${MAX_SERVICE_TAGS}`,
      },
    },
    gender: {
      type: String,
      enum: Object.values(ServiceGender),
      default: ServiceGender.ALL,
    },
    status: {
      type: String,
      enum: Object.values(ServiceStatus),
      default: ServiceStatus.PENDING_APPROVAL,
      index: true,
    },
    rejectionReason: { type: String, trim: true, default: null },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectedAt: { type: Date, default: null },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: { type: Date, default: null },
    displayOrder: { type: Number, default: 0, min: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    deletedAt: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true },
);

serviceSchema.pre('validate', function validateDurations(next) {
  if (
    this.durationMinMinutes != null &&
    this.durationMaxMinutes != null &&
    Number(this.durationMinMinutes) > Number(this.durationMaxMinutes)
  ) {
    return next(new Error('durationMaxMinutes must be >= durationMinMinutes'));
  }
  return next();
});

serviceSchema.index({ status: 1, isActive: 1, deletedAt: 1, displayOrder: 1 });
serviceSchema.index({ categoryId: 1, status: 1, isActive: 1, deletedAt: 1 });
serviceSchema.index({ createdBy: 1, deletedAt: 1 });
serviceSchema.index({ isFeatured: 1, status: 1, isActive: 1, deletedAt: 1 });
serviceSchema.index({ isPopular: 1, status: 1, isActive: 1, deletedAt: 1 });
serviceSchema.index({ isTrending: 1, status: 1, isActive: 1, deletedAt: 1 });
serviceSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
serviceSchema.index({ name: 'text', shortDescription: 'text', tags: 'text' });

serviceSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const ServiceModel =
  mongoose.models.Service ||
  mongoose.model('Service', serviceSchema, 'services');

export default ServiceModel;
