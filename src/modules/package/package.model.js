import mongoose from 'mongoose';
import {
  PackageType,
  PackageStatus,
  PackageChangeRequestStatus,
  PackageGender,
  PackageDiscountType,
  PackageBadge,
} from './package.enum.js';

const packageItemSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'Service ID is required'],
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category ID is required'],
    },
    groupTitle: {
      type: String,
      trim: true,
      default: null,
    },
    isMandatory: {
      type: Boolean,
      default: false,
    },
    isDefaultSelected: {
      type: Boolean,
      default: false,
    },
    badgeTags: {
      type: [{ type: String, trim: true }],
      default: [],
    },
    extraCharge: {
      type: Number,
      min: 0,
      default: 0,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  { _id: true },
);

const packageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Package name is required'],
      trim: true,
      maxLength: [150, 'Package name cannot exceed 150 characters'],
      index: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    badgeTag: {
      type: String,
      trim: true,
      default: null,
    },
    shortDescription: {
      type: String,
      trim: true,
      maxLength: [300, 'Short description cannot exceed 300 characters'],
    },
    description: {
      type: String,
      trim: true,
    },
    packageType: {
      type: String,
      enum: Object.values(PackageType),
      default: PackageType.FIXED,
    },

    minSelectCount: {
      type: Number,
      default: 1,
      min: [1, 'Minimum selection count must be at least 1'],
    },
    maxSelectCount: {
      type: Number,
      default: 1,
      min: [1, 'Maximum selection count must be at least 1'],
    },
    selectionNotice: {
      type: String,
      default: 'You can select up to the allowed number of services in this package.',
    },

    items: {
      type: [packageItemSchema],
      validate: [
        (val) => Array.isArray(val) && val.length > 0,
        'Package must contain at least one service item',
      ],
    },

    categoryIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        index: true,
      },
    ],

    thumbnail: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },
    images: [
      {
        url: { type: String, required: true },
        publicId: { type: String, default: null },
        displayOrder: { type: Number, default: 0 },
      },
    ],

    durationMinMinutes: {
      type: Number,
      default: 60,
      min: 0,
    },
    durationMaxMinutes: {
      type: Number,
      default: 120,
      min: 0,
    },

    originalPrice: {
      type: Number,
      default: 0,
      min: [0, 'Original price cannot be negative'],
    },
    approxPrice: {
      type: Number,
      default: null,
      min: 0,
    },
    price: {
      type: Number,
      default: null,
      min: 0,
    },
    discountType: {
      type: String,
      enum: Object.values(PackageDiscountType),
      default: PackageDiscountType.NONE,
    },
    discountValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountedPrice: {
      type: Number,
      default: null,
      min: 0,
    },

    badges: {
      type: [
        {
          type: String,
          enum: Object.values(PackageBadge),
        },
      ],
      default: [],
    },

    ratingAvg: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
      set: (v) => Math.round(v * 10) / 10,
    },
    ratingCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    bookingCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    socialProofText: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: Object.values(PackageStatus),
      default: PackageStatus.PENDING_APPROVAL,
      index: true,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    gender: {
      type: String,
      enum: Object.values(PackageGender),
      default: PackageGender.ALL,
      index: true,
    },
    isPopular: {
      type: Boolean,
      default: false,
      index: true,
    },
    isTrending: {
      type: Boolean,
      default: false,
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    isHomeServiceAvailable: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },

    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

packageSchema.index({ status: 1, isActive: 1, deletedAt: 1 });
packageSchema.index({ categoryIds: 1, status: 1, isActive: 1 });
packageSchema.index({ gender: 1, price: 1, ratingAvg: -1 });

packageSchema.pre('save', function (next) {
  if (this.price !== null && this.price !== undefined) {
    if (this.discountType === PackageDiscountType.PERCENTAGE && this.discountValue > 0) {
      this.discountedPrice = Math.max(0, Math.round(this.price * (1 - this.discountValue / 100)));
    } else if (this.discountType === PackageDiscountType.FIXED && this.discountValue > 0) {
      this.discountedPrice = Math.max(0, this.price - this.discountValue);
    } else {
      this.discountedPrice = this.price;
    }
  }

  if (Array.isArray(this.items) && this.items.length > 0) {
    const cats = new Set(this.items.map((item) => item.categoryId?.toString()).filter(Boolean));
    this.categoryIds = Array.from(cats);
  }

  next();
});

export const PackageModel =
  mongoose.models.Package || mongoose.model('Package', packageSchema, 'packages');

/**
 * Package Change Request Schema (for Beautician update approval workflow)
 */
const packageChangeRequestSchema = new mongoose.Schema(
  {
    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Package',
      required: true,
      index: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    changes: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    diff: [
      {
        field: String,
        label: String,
        oldValue: mongoose.Schema.Types.Mixed,
        newValue: mongoose.Schema.Types.Mixed,
      },
    ],
    status: {
      type: String,
      enum: Object.values(PackageChangeRequestStatus),
      default: PackageChangeRequestStatus.PENDING,
      index: true,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

export const PackageChangeRequestModel =
  mongoose.models.PackageChangeRequest ||
  mongoose.model('PackageChangeRequest', packageChangeRequestSchema, 'package_change_requests');
