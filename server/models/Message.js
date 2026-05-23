import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Direct Messaging
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },      // Team Channel Chatting
    content: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model('Message', MessageSchema);
