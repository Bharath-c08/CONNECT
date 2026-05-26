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
    shiftType: {
      type: String,
      enum: ['regular', 'overtime'],
      default: 'regular'
    },
    sessionLimitMinutes: { type: Number, default: 480 },
    status: {
      type: String,
      enum: ['active', 'on_break', 'completed'],
      default: 'active',
    },
    breaks: [{
      breakType: { type: String, required: true },
      duration: { type: Number, required: true }, // limit duration in minutes
      startedAt: { type: Date, required: true },
      endedAt: { type: Date }
    }],
    needsApproval: { type: Boolean, default: false },
    approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'] },
    autoClockedOut: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.model('Session', SessionSchema);
