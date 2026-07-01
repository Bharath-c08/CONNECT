import mongoose from 'mongoose';

const EventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    date: { type: Date, required: true },
    targetTeams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true }],
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

export default mongoose.model('Event', EventSchema);
