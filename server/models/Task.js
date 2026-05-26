import mongoose from 'mongoose';

const TaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'waiting_for_approval', 'completed'],
      default: 'pending',
    },
    operatorComments: { type: String },
    adminFeedback: { type: String },
    oneHourAlertSent: { type: Boolean, default: false },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
  },
  { timestamps: true }
);

export default mongoose.model('Task', TaskSchema);
