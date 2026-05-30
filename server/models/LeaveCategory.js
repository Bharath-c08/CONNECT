import mongoose from 'mongoose';

const LeaveCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, lowercase: true, trim: true },
    label: { type: String, required: true },
    defaultDays: { type: Number, required: true, default: 10 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('LeaveCategory', LeaveCategorySchema);
