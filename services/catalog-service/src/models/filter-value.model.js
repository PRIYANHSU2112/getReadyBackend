import mongoose from 'mongoose';

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

export const FilterValueModel = mongoose.models.FilterValue || mongoose.model('FilterValue', filterValueSchema);
export default FilterValueModel;
