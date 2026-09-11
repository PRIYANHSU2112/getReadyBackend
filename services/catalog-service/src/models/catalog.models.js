import mongoose from 'mongoose';

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, default: null },
    publicId: { type: String, trim: true, default: null },
  },
  { _id: false },
);

// 1. Category Model
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

// 2. Service Model
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
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
serviceSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

// 3. Service Change Request Model
const serviceChangeRequestSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
      index: true,
    },
    requestedBy: { type: String, required: true },
    changes: { type: mongoose.Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, trim: true, default: null },
  },
  { timestamps: true },
);
serviceChangeRequestSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

// 4. Package Model
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
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
packageSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

// 5. Filter Models
const filterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    displayType: {
      type: String,
      enum: ['chips', 'checkbox', 'radio', 'dropdown', 'range'],
      default: 'chips',
    },
    selectionType: {
      type: String,
      enum: ['single', 'multiple'],
      default: 'single',
    },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
filterSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

const filterValueSchema = new mongoose.Schema(
  {
    filterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Filter',
      required: true,
      index: true,
    },
    label: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
filterValueSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

// 6. Hygiene Kit Model
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

// 7. Coupon Model
const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    name: { type: String, trim: true, default: null },
    description: { type: String, trim: true, default: null },
    discountType: {
      type: String,
      enum: ['FLAT', 'PERCENTAGE'],
      default: 'FLAT',
    },
    discountValue: { type: Number, required: true, min: 0 },
    minOrderValue: { type: Number, default: 0, min: 0 },
    maxDiscountAmount: { type: Number, default: null, min: 0 },
    usageLimit: { type: Number, default: 1000, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'EXPIRED'],
      default: 'ACTIVE',
      index: true,
    },
    validFrom: { type: Date, default: Date.now },
    validTo: { type: Date, default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
    isActive: { type: Boolean, default: true, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

couponSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  obj.name = obj.code || obj.name;
  obj.discount = obj.discountType === 'PERCENTAGE' ? `${obj.discountValue}% OFF` : `₹${obj.discountValue} FLAT`;
  obj.used = obj.usedCount || 0;
  obj.status = obj.status || (obj.isActive ? 'ACTIVE' : 'INACTIVE');
  return obj;
};

export const CategoryModel = mongoose.models.Category || mongoose.model('Category', categorySchema);
export const ServiceModel = mongoose.models.Service || mongoose.model('Service', serviceSchema);
export const ServiceChangeRequestModel = mongoose.models.ServiceChangeRequest || mongoose.model('ServiceChangeRequest', serviceChangeRequestSchema);
export const PackageModel = mongoose.models.Package || mongoose.model('Package', packageSchema);
export const FilterModel = mongoose.models.Filter || mongoose.model('Filter', filterSchema);
export const FilterValueModel = mongoose.models.FilterValue || mongoose.model('FilterValue', filterValueSchema);
export const HygieneKitModel = mongoose.models.HygieneKit || mongoose.model('HygieneKit', hygieneKitSchema);
export const CouponModel = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);
