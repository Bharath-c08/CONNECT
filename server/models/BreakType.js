import mongoose from 'mongoose';

const BreakTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, uppercase: true, trim: true },
    duration: { type: Number, required: true }, // duration in minutes
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

export default mongoose.model('BreakType', BreakTypeSchema);
