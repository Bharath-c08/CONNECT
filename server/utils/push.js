import webpush from 'web-push';
import User from '../models/User.js';

let vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || 'BHYcPxn3TRLGKCXd6Ywo0FjDvKYo8pIF5Wv4LXpIj24HeThKhKeL6d-RreBqjf15CpITXHhUmFXmIvPy9m6BbYg',
  privateKey: process.env.VAPID_PRIVATE_KEY || 'uWYT8Zjzeukhd_qJFwbi6EUdlY46EefoFe7jiuxzSPQ'
};

webpush.setVapidDetails(
  'mailto:admin@connect.portal',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

export const getVapidPublicKey = () => vapidKeys.publicKey;

export const sendPushNotification = async (userId, title, body, url = '/dashboard') => {
  try {
    const user = await User.findById(userId);
    if (!user || !user.pushSubscriptions || user.pushSubscriptions.length === 0) {
      return;
    }

    const payload = JSON.stringify({
      title,
      body,
      url
    });

    const sendPromises = user.pushSubscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, payload);
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expired or invalid, remove it
          await User.findByIdAndUpdate(userId, {
            $pull: { pushSubscriptions: sub }
          });
        } else {
          console.error('Error sending push notification to subscription:', err.message);
        }
      }
    });

    await Promise.all(sendPromises);
  } catch (error) {
    console.error('Failed to dispatch push notification payloads:', error);
  }
};
