import webpush from 'web-push';
import User from '../models/User.js';

let vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY
};

// Generate on-the-fly keys if none are set
if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  const keys = webpush.generateVAPIDKeys();
  vapidKeys.publicKey = keys.publicKey;
  vapidKeys.privateKey = keys.privateKey;
  console.log('---------------------------------------------------------');
  console.log('★ AUTO-GENERATED VAPID KEYS FOR PWA PUSH NOTIFICATIONS ★');
  console.log('PUBLIC KEY:', keys.publicKey);
  console.log('PRIVATE KEY:', keys.privateKey);
  console.log('---------------------------------------------------------');
}

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
