import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: { type: String, default: '', trim: true },
    permissions: {
      type: [String],
      default: [],
    },
    isSystem: { type: Boolean, default: false },
    isSuperAdmin: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

roleSchema.index({ isActive: 1, slug: 1 });
roleSchema.index({ name: 1 });

roleSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const RoleModel = mongoose.models.Role || mongoose.model('Role', roleSchema);

export default RoleModel;
