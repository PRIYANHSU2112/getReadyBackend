import mongoose from 'mongoose';
import {
  BeauticianProfileStatus,
  KycStatus,
} from '../../common/constants/enums.js';
import { VALID_DAYS, MAX_BIO_LENGTH } from '../../common/constants/beautician-profile.js';

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, default: null },
    publicId: { type: String, trim: true, default: null },
  },
  { _id: false },
);

const preferredHoursSchema = new mongoose.Schema(
  {
    startTime: { type: String, trim: true, default: null },
    endTime: { type: String, trim: true, default: null },
    days: {
      type: [{ type: String, trim: true, lowercase: true, enum: VALID_DAYS }],
      default: [],
    },
  },
  { _id: false },
);

const kycSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: Object.values(KycStatus),
      default: KycStatus.PENDING,
      index: true,
    },
    rejectionReason: { type: String, trim: true, default: null },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    verifiedAt: { type: Date, default: null },
    selfieImage: {
      type: mediaSchema,
      default: () => ({ url: null, publicId: null }),
    },
    idCardFront: {
      type: mediaSchema,
      default: () => ({ url: null, publicId: null }),
    },
    idCardBack: {
      type: mediaSchema,
      default: () => ({ url: null, publicId: null }),
    },
  },
  { _id: false },
);

const beauticianProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      unique: true,
      index: true,
    },

    // ── Personal Details ──────────────────────────────────────
    languages: {
      type: [{ type: String, trim: true, maxlength: 50 }],
      default: [],
    },
    bio: { type: String, trim: true, maxlength: MAX_BIO_LENGTH, default: null },

    // ── Skills & Experience ────────────────────────────────────
    skills: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Skill',
      },
    ],
    yearsOfExperience: { type: Number, default: null, min: 0, max: 60 },

    // ── Working Schedule / Preferred Hours ─────────────────────
    preferredHours: {
      type: preferredHoursSchema,
      default: () => ({ startTime: null, endTime: null, days: [] }),
    },

    // ── Rating & Statistics ────────────────────────────────────
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

    // ── KYC & Identity Verification (Embedded Object) ─────────
    kyc: {
      type: kycSchema,
      default: () => ({
        status: KycStatus.PENDING,
        rejectionReason: null,
        verifiedBy: null,
        verifiedAt: null,
        selfieImage: { url: null, publicId: null },
        idCardFront: { url: null, publicId: null },
        idCardBack: { url: null, publicId: null },
      }),
    },

    // ── Profile Verification / Review ─────────────────────────
    profileStatus: {
      type: String,
      enum: Object.values(BeauticianProfileStatus),
      default: BeauticianProfileStatus.PENDING,
      index: true,
    },
    rejectionReason: { type: String, trim: true, default: null },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: null },

    isActive: { type: Boolean, default: true, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

beauticianProfileSchema.index({ profileStatus: 1, isActive: 1, deletedAt: 1 });
beauticianProfileSchema.index({ userId: 1, deletedAt: 1 });
beauticianProfileSchema.index({ 'kyc.status': 1, profileStatus: 1 });
beauticianProfileSchema.index({ ratingAvg: -1, ratingCount: -1 });

beauticianProfileSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const BeauticianProfileModel =
  mongoose.models.BeauticianProfile ||
  mongoose.model('BeauticianProfile', beauticianProfileSchema, 'beautician_profiles');

export default BeauticianProfileModel;
