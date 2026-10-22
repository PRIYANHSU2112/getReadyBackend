import mongoose from 'mongoose';

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

export const FilterModel = mongoose.models.Filter || mongoose.model('Filter', filterSchema);
export default FilterModel;
