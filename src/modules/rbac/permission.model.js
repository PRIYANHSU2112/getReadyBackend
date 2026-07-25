import mongoose from 'mongoose';

const permissionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      unique: true,
      trim: true,
      index: true,
    },
    module: { type: String, required: true, trim: true, index: true },
    action: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

permissionSchema.index({ module: 1, action: 1 });
permissionSchema.index({ isActive: 1, module: 1 });

permissionSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const PermissionModel =
  mongoose.models.Permission || mongoose.model('Permission', permissionSchema);

export default PermissionModel;
