import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserRole, Gender } from '../../common/constants/enums.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // No default: null — Mongo unique indexes treat multiple nulls as duplicates.
    // Uniqueness uses partialFilterExpression below (only real string values).
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    password: { type: String, minlength: 8, select: false },
    role: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      default: UserRole.CUSTOMER,
      index: true,
    },
    profileImage: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },
    gender: {
      type: String,
      enum: Object.values(Gender),
      default: null,
    },
    dob: { type: Date, default: null },
    referralCode: {
      type: String,
      uppercase: true,
      trim: true,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    fcmToken: { type: String, default: null },
    phoneVerifiedAt: { type: Date, default: null },
    emailVerifiedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Unique only when the field is a real string (many users may omit email/phone)
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } },
);
userSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: 'string' } } },
);
userSchema.index(
  { referralCode: 1 },
  { unique: true, partialFilterExpression: { referralCode: { $type: 'string' } } },
);
userSchema.index({ role: 1, isActive: 1, deletedAt: 1, createdAt: -1 });
userSchema.index({ referredBy: 1 });
userSchema.index({ name: 1 });
userSchema.index({ lastLoginAt: -1 });

/** Drop empty optional unique fields so they are omitted (not stored as null). */
userSchema.pre('validate', function stripEmptyUniqueFields(next) {
  if (this.email === null || this.email === '') this.email = undefined;
  if (this.phone === null || this.phone === '') this.phone = undefined;
  if (this.password === null || this.password === '') this.password = undefined;
  if (this.referralCode === null || this.referralCode === '') this.referralCode = undefined;
  next();
});

userSchema.pre('validate', function validateRoleFields(next) {
  if (this.role === UserRole.ADMIN || this.role === UserRole.SUPER_ADMIN) {
    if (!this.email) {
      return next(new Error('Email is required for admin users'));
    }
    if (this.isNew && !this.password) {
      return next(new Error('Password is required for admin users'));
    }
  }

  if (this.role === UserRole.CUSTOMER || this.role === UserRole.BEAUTICIAN) {
    if (!this.phone) {
      return next(new Error('Phone is required for customer and beautician users'));
    }
  }

  return next();
});

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  return next();
});

userSchema.methods.comparePassword = async function comparePassword(candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export const UserModel = mongoose.models.User || mongoose.model('User', userSchema);
export default UserModel;
