import mongoose from 'mongoose';
import { MemberRelationship, MemberSkinType } from '../../common/constants/enums.js';
import {
  MAX_MEMBER_NAME_LENGTH,
  MAX_MEDICAL_NOTES_LENGTH,
} from '../../common/constants/member.js';

const memberSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Member name is required'],
      trim: true,
      maxlength: MAX_MEMBER_NAME_LENGTH,
    },
    relationship: {
      type: String,
      enum: Object.values(MemberRelationship),
      required: true,
      uppercase: true,
      trim: true,
    },
    age: {
      type: Number,
      default: null,
      min: 1,
      max: 120,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
      match: /^\+?[1-9]\d{7,14}$/,
    },
    avatarUrl: {
      type: String,
      trim: true,
      default: null,
      maxlength: 500,
    },
    skinType: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
      validate: {
        validator(v) {
          return v == null || Object.values(MemberSkinType).includes(v);
        },
        message: 'Invalid skin type',
      },
    },
    medicalNotes: {
      type: String,
      trim: true,
      default: null,
      maxlength: MAX_MEDICAL_NOTES_LENGTH,
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

memberSchema.index({ userId: 1, deletedAt: 1, createdAt: -1 });

memberSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const MemberModel =
  mongoose.models.Member || mongoose.model('Member', memberSchema);

export default MemberModel;
