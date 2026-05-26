import mongoose from 'mongoose';

const MeetingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    meetingId: { type: String, required: true, unique: true }, // slug e.g. 'xyz-123-abc'
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  { timestamps: true }
);

export default mongoose.model('Meeting', MeetingSchema);
