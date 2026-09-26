import mongoose from 'mongoose';

const GoalSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      enum: ['Company', 'Department', 'Individual'],
      default: 'Individual',
    },
    targetValue: {
      type: Number,
      required: true,
      default: 100,
    },
    currentValue: {
      type: Number,
      default: 0,
    },
    unit: {
      type: String,
      enum: ['%', 'Tasks', '$', 'Units', 'Items'],
      default: '%',
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    quarter: {
      type: String,
      enum: ['Q1', 'Q2', 'Q3', 'Q4'],
      default: 'Q3',
    },
    year: {
      type: Number,
      default: () => new Date().getFullYear(),
    },
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed', 'at_risk'],
      default: 'in_progress',
    },
    dueDate: {
      type: Date,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Goal', GoalSchema);
