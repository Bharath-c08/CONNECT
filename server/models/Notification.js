import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['message', 'call', 'system', 'task', 'leave', 'password_reset'],
    default: 'system'
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  link: {
    type: String,
    default: null
  }
}, { timestamps: true });

notificationSchema.post('save', async function (doc) {
  try {
    const { sendPushNotification } = await import('../utils/push.js');
    sendPushNotification(doc.recipientId, doc.title, doc.message, doc.link || '/dashboard');
  } catch (err) {
    console.error('Error in Notification post-save push hook:', err);
  }
});

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
