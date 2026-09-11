import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    subject: { type: String, trim: true, required: true },
    description: { type: String, trim: true, default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    userName: { type: String, trim: true, default: 'Customer' },
    userPhone: { type: String, trim: true, default: null },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
    },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'ACTIVE', 'PENDING'],
      default: 'OPEN',
      index: true,
    },
    category: { type: String, trim: true, default: 'General' },
    assignedTo: { type: String, trim: true, default: null },
    resolutionNotes: { type: String, trim: true, default: null },
    messages: [
      {
        sender: { type: String, enum: ['USER', 'AGENT', 'SYSTEM'], default: 'USER' },
        message: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

ticketSchema.pre('save', function (next) {
  if (!this.ticketNumber) {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    this.ticketNumber = `TCK-${randomSuffix}`;
  }
  next();
});

ticketSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj.ticketNumber || (obj._id ? `TCK-${obj._id.toString().slice(-6).toUpperCase()}` : 'TCK-000001');
  obj.name = obj.subject;
  obj.status = obj.status || 'OPEN';
  return obj;
};

export const TicketModel = mongoose.models.Ticket || mongoose.model('Ticket', ticketSchema);
export default TicketModel;
