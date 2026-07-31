import mongoose from 'mongoose';
import { MAX_SKILL_NAME_LENGTH } from '../../common/constants/skill.js';

const skillSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Skill name is required'],
      trim: true,
      maxlength: [MAX_SKILL_NAME_LENGTH, `Skill name cannot exceed ${MAX_SKILL_NAME_LENGTH} characters`],
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    icon: { type: String, trim: true, default: null },
    isActive: { type: Boolean, default: true, index: true },
    displayOrder: { type: Number, default: 0, min: 0 },
    deletedAt: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true },
);

skillSchema.index({ deletedAt: 1, isActive: 1, displayOrder: 1 });
skillSchema.index({ categoryId: 1, deletedAt: 1, isActive: 1 });
skillSchema.index({ name: 'text' });

skillSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const SkillModel =
  mongoose.models.Skill || mongoose.model('Skill', skillSchema, 'skills');

export default SkillModel;
