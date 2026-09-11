import mongoose from 'mongoose';

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, default: null },
    publicId: { type: String, trim: true, default: null },
  },
  { _id: false },
);

const documentItemSchema = new mongoose.Schema(
  {
    docType: {
      type: String,
      enum: ['aadhaar_front', 'aadhaar_back', 'pan', 'license', 'police_verification', 'insurance', 'other'],
      required: true,
    },
    docNumber: { type: String, trim: true, default: null },
    file: { type: mediaSchema, default: () => ({ url: null, publicId: null }) },
    status: {
      type: String,
      enum: ['NOT_UPLOADED', 'PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED'],
      default: 'PENDING',
    },
    uploadedAt: { type: Date, default: Date.now },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: String, default: null },
    rejectionReason: { type: String, trim: true, default: null },
  },
  { _id: true },
);

const skillDetailSchema = new mongoose.Schema(
  {
    skillId: { type: String, default: null },
    skillName: { type: String, required: true, trim: true },
    experienceYears: { type: Number, default: 1, min: 0 },
    proficiency: {
      type: String,
      enum: ['BEGINNER', 'INTERMEDIATE', 'EXPERT', 'MASTER'],
      default: 'EXPERT',
    },
    isActive: { type: Boolean, default: true },
  },
  { _id: true },
);

const breakSchema = new mongoose.Schema(
  {
    start: { type: String, default: '13:00' },
    end: { type: String, default: '14:00' },
    label: { type: String, default: 'Lunch Break' },
  },
  { _id: false },
);

// 1. Beautician Profile Model
const beauticianProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    bio: { type: String, trim: true, default: null },
    experienceYears: { type: Number, default: 0, min: 0 },
    skills: { type: [String], default: [] },
    skillDetails: { type: [skillDetailSchema], default: [] },
    eligibleServiceIds: { type: [String], default: [] },
    languages: { type: [String], default: ['Hindi', 'English'] },
    alternatePhone: { type: String, trim: true, default: null },
    emergencyContact: {
      name: { type: String, trim: true, default: null },
      phone: { type: String, trim: true, default: null },
      relation: { type: String, trim: true, default: null },
    },
    profilePhoto: { type: mediaSchema, default: () => ({ url: null, publicId: null }) },

    // Address & Service Area
    address: {
      line1: { type: String, trim: true, default: '' },
      line2: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: 'Bhopal' },
      state: { type: String, trim: true, default: 'Madhya Pradesh' },
      pincode: { type: String, trim: true, default: '462003' },
      country: { type: String, trim: true, default: 'India' },
      location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [77.4126, 23.2599] }, // [lng, lat]
      },
    },
    serviceRadiusKm: { type: Number, default: 8, min: 1, max: 100 },
    operationalArea: { type: String, trim: true, default: null },

    // Availability & Operational Fleet Status
    operationalStatus: {
      type: String,
      enum: ['ONLINE', 'OFFLINE', 'BUSY', 'AVAILABLE', 'ON_LEAVE', 'SUSPENDED'],
      default: 'OFFLINE',
      index: true,
    },
    isAvailable: { type: Boolean, default: true },
    workingHours: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '18:00' },
    },
    workingDays: {
      type: [String],
      default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    },
    breaks: { type: [breakSchema], default: () => [{ start: '13:00', end: '14:00', label: 'Lunch Break' }] },

    // Documents & KYC
    documents: { type: [documentItemSchema], default: [] },
    idCardFront: { type: mediaSchema, default: () => ({ url: null, publicId: null }) },
    idCardBack: { type: mediaSchema, default: () => ({ url: null, publicId: null }) },
    selfieWithId: { type: mediaSchema, default: () => ({ url: null, publicId: null }) },
    selfieVerification: {
      status: {
        type: String,
        enum: ['PENDING', 'VERIFIED', 'FAILED', 'NEEDS_REVERIFICATION'],
        default: 'PENDING',
      },
      verifiedAt: { type: Date, default: null },
      remarks: { type: String, trim: true, default: null },
    },
    kycStatus: {
      type: String,
      enum: ['PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED'],
      default: 'PENDING',
      index: true,
    },
    kycRejectionReason: { type: String, trim: true, default: null },

    // Overall Lifecycle Status
    status: {
      type: String,
      enum: ['DRAFT', 'INCOMPLETE', 'SUBMITTED', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED', 'DEACTIVATED'],
      default: 'DRAFT',
      index: true,
    },
    rejectionReason: { type: String, trim: true, default: null },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: String, default: null },
    isDraft: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },

    // Performance & Ratings KPIs
    ratingAvg: { type: Number, default: 5.0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    completedBookingsCount: { type: Number, default: 0, min: 0 },
    monthlyEarnings: { type: Number, default: 0, min: 0 },

    beauticianNumber: {
      type: String,
      trim: true,
      index: true,
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

beauticianProfileSchema.index(
  { beauticianNumber: 1 },
  { unique: true, partialFilterExpression: { beauticianNumber: { $type: 'string' } } },
);

beauticianProfileSchema.pre('validate', function generateBeauticianNumber(next) {
  if (!this.beauticianNumber) {
    const randomHex = Math.floor(100000 + Math.random() * 900000);
    this.beauticianNumber = `GRBT${randomHex}`;
  }
  next();
});

beauticianProfileSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  obj.beauticianId = obj.beauticianNumber || (obj.id ? `GRBT${obj.id.slice(-6).toUpperCase()}` : 'GRBT000001');
  return obj;
};

// 2. Work History Model
const workHistorySchema = new mongoose.Schema(
  {
    beauticianProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BeauticianProfile',
      required: true,
      index: true,
    },
    companyName: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    isCurrent: { type: Boolean, default: false },
    description: { type: String, trim: true, default: null },
  },
  { timestamps: true },
);

workHistorySchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

// 3. Certificate Model
const certificateSchema = new mongoose.Schema(
  {
    beauticianProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BeauticianProfile',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    issuingOrganization: { type: String, required: true, trim: true },
    issueDate: { type: Date, required: true },
    expiryDate: { type: Date, default: null },
    certificateImage: { type: mediaSchema, default: () => ({ url: null, publicId: null }) },
    status: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    rejectionReason: { type: String, trim: true, default: null },
  },
  { timestamps: true },
);

certificateSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

// 4. Skill Model
const skillSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, trim: true, default: null },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

skillSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

// 5. Bank Detail Model
const bankDetailSchema = new mongoose.Schema(
  {
    beauticianProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BeauticianProfile',
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    accountHolderName: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, trim: true },
    ifscCode: { type: String, required: true, trim: true, uppercase: true },
    bankName: { type: String, trim: true, default: null },
    branchName: { type: String, trim: true, default: null },
    passbookImage: { type: mediaSchema, default: () => ({ url: null, publicId: null }) },
    upiId: { type: String, trim: true, default: null },
    status: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    rejectionReason: { type: String, trim: true, default: null },
    verifiedBy: { type: String, default: null },
    verifiedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

bankDetailSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  if (obj.accountNumber && obj.accountNumber.length > 4) {
    obj.maskedAccountNumber = '****' + obj.accountNumber.slice(-4);
  }
  return obj;
};

export const BeauticianProfileModel =
  mongoose.models.BeauticianProfile || mongoose.model('BeauticianProfile', beauticianProfileSchema);

export const WorkHistoryModel =
  mongoose.models.WorkHistory || mongoose.model('WorkHistory', workHistorySchema);

export const CertificateModel =
  mongoose.models.Certificate || mongoose.model('Certificate', certificateSchema);

export const SkillModel =
  mongoose.models.Skill || mongoose.model('Skill', skillSchema);

export const BankDetailModel =
  mongoose.models.BankDetail || mongoose.model('BankDetail', bankDetailSchema);
