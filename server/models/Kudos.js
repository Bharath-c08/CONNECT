import mongoose from 'mongoose';

const KudosSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    badge: {
      type: String,
      required: true,
      enum: [
        'Team Player',
        'Problem Solver',
        'Code Wizard',
        'Overachiever',
        'Leadership',
        'Star Collaborator',
        'Innovator',
        'Customer Hero',
      ],
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    points: {
      type: Number,
      default: 10,
      min: 5,
      max: 100,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Kudos', KudosSchema);
