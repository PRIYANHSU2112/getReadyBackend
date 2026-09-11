import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    password: { type: String, minlength: 6, select: false },
    role: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      default: 'customer',
      index: true,
    },
    profileImage: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },
    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'OTHER', 'male', 'female', 'other'],
      uppercase: true,
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
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DEACTIVATED'],
      default: 'ACTIVE',
      index: true,
    },
    userNumber: {
      type: String,
      trim: true,
      index: true,
    },
    notes: { type: String, trim: true, default: null },
    languages: { type: [String], default: ['Hindi', 'English'] },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

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
userSchema.index(
  { userNumber: 1 },
  { unique: true, partialFilterExpression: { userNumber: { $type: 'string' } } },
);
userSchema.index({ role: 1, isActive: 1, deletedAt: 1, createdAt: -1 });

userSchema.pre('validate', function stripEmptyUniqueFields(next) {
  if (this.email === null || this.email === '') this.email = undefined;
  if (this.phone === null || this.phone === '') this.phone = undefined;
  if (this.password === null || this.password === '') this.password = undefined;
  if (this.referralCode === null || this.referralCode === '') this.referralCode = undefined;
  if (!this.userNumber) {
    const randomHex = Math.floor(100000 + Math.random() * 900000);
    this.userNumber = `GRUSR${randomHex}`;
  }
  next();
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
  obj.id = obj._id?.toString();
  obj.userId = obj.userNumber || `GRUSR${obj.id ? obj.id.slice(-6).toUpperCase() : '000001'}`;
  return obj;
};

export const UserModel = mongoose.models.User || mongoose.model('User', userSchema);
export default UserModel;
