import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    clockIn: { type: Date, required: true },
    clockOut: { type: Date },
    location: {
      lat: { type: Number },
      lng: { type: Number },
      address: { type: String }
    },
    duration: { type: Number, default: 0 }, // Duration in minutes
    overtimeMinutes: { type: Number, default: 0 },
    overtimePay: { type: Number, default: 0 },
    regularPay: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['active', 'completed'],
      default: 'active',
    },
  },
  { timestamps: true }
);

export default mongoose.model('Session', SessionSchema);
