import mongoose from 'mongoose';

const ReviewSchema = new mongoose.Schema(
  {
    revieweeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reviewType: {
      type: String,
      enum: ['self', 'peer', 'manager'],
      default: 'peer',
    },
    period: {
      type: String,
      required: true,
      default: '2026-Q3',
    },
    ratings: {
      technical: { type: Number, min: 1, max: 5, default: 4 },
      communication: { type: Number, min: 1, max: 5, default: 4 },
      leadership: { type: Number, min: 1, max: 5, default: 4 },
      punctuality: { type: Number, min: 1, max: 5, default: 4 },
      teamwork: { type: Number, min: 1, max: 5, default: 4 },
    },
    feedback: {
      type: String,
      trim: true,
    },
    strengths: {
      type: String,
      trim: true,
    },
    improvements: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['draft', 'submitted'],
      default: 'submitted',
    },
  },
  { timestamps: true }
);

export default mongoose.model('Review', ReviewSchema);
