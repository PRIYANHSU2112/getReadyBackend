import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    jti: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0, // MongoDB TTL index to auto-delete expired documents
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    replacedByToken: {
      type: String,
      default: null,
    },
    createdByIp: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

refreshTokenSchema.index({ userId: 1, isRevoked: 1 });

export const RefreshTokenModel =
  mongoose.models.RefreshToken ||
  mongoose.model('RefreshToken', refreshTokenSchema, 'refresh_tokens');

export default RefreshTokenModel;
