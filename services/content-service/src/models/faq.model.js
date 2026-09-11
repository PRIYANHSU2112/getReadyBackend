import mongoose from 'mongoose';

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['General', 'Booking', 'Services', 'Membership', 'Payment', 'Hygiene & Safety', 'Cancellation'],
      default: 'General',
    },
    displayOrder: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

faqSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const FaqModel = mongoose.models.Faq || mongoose.model('Faq', faqSchema);
export default FaqModel;
