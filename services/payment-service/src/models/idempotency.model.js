import mongoose from 'mongoose';

const idempotencySchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true },
    eventType: { type: String, required: true },
    service: { type: String, required: true },
    processedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export const IdempotencyModel = mongoose.models.Idempotency || mongoose.model('Idempotency', idempotencySchema);
