import mongoose from 'mongoose';

const beautyPassportEntrySchema = new mongoose.Schema(
  {
    serviceId: { type: String, required: true },
    serviceName: { type: String, required: true },
    bookingId: { type: String, required: true },
    completedAt: { type: Date, default: Date.now },
    beauticianId: { type: String, default: null },
    beauticianName: { type: String, default: null },
    notes: { type: String, default: null },
    reactions: { type: String, default: null },
  },
  { _id: true },
);

const customerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    accountOwnerId: {
      type: String,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    relationship: {
      type: String,
      default: 'Self',
      trim: true,
    },
    age: { type: Number, min: 0, max: 120, default: null },
    mobileNumber: { type: String, trim: true, default: null },
    phone: { type: String, trim: true, default: null },
    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'OTHER', 'male', 'female', 'other'],
      default: 'FEMALE',
    },
    skinType: { type: String, trim: true, default: null },
    hairType: { type: String, trim: true, default: null },
    allergies: { type: [String], default: [] },
    notes: { type: String, trim: true, default: null },
    avatarUrl: { type: String, trim: true, default: null },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
    },
    isActive: { type: Boolean, default: true },
    beautyPassport: {
      serviceHistory: { type: [beautyPassportEntrySchema], default: [] },
      skinConcerns: { type: [String], default: [] },
      hairConcerns: { type: [String], default: [] },
      preferences: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

customerProfileSchema.pre('save', function (next) {
  if (this.userId && !this.accountOwnerId) {
    this.accountOwnerId = this.userId.toString();
  }
  if (this.mobileNumber && !this.phone) {
    this.phone = this.mobileNumber;
  }
  next();
});

customerProfileSchema.index({ userId: 1, deletedAt: 1 });
customerProfileSchema.index({ accountOwnerId: 1, deletedAt: 1 });

customerProfileSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const MemberModel = mongoose.models.Member || mongoose.model('Member', customerProfileSchema);
export const CustomerProfileModel = MemberModel;
export default MemberModel;
