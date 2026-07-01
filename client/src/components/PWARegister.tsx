'use client';

import { useEffect } from 'react';
import { apiRequest } from '../utils/api';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Register Service Worker
    if ('serviceWorker' in navigator) {
      const registerSW = () => {
        navigator.serviceWorker.register('/sw.js')
          .then((reg) => {
            console.log('Service Worker registered successfully with scope:', reg.scope);
            
            // Check if logged in, then prompt for push notification subscription
            const token = localStorage.getItem('token');
            if (token) {
              setupPushSubscription(reg);
            }
          })
          .catch((err) => {
            console.error('Service Worker registration failed:', err);
          });
      };

      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
      }
    }

    async function setupPushSubscription(registration: ServiceWorkerRegistration) {
      try {
        // Request browser permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.log('Notification permission not granted.');
          return;
        }

        // Fetch VAPID public key from backend
        const keyRes = await apiRequest('/notifications/push/key');
        if (!keyRes || !keyRes.publicKey) {
          console.error('VAPID public key not found on server.');
          return;
        }

        // Check if already subscribed
        let subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          // Verify VAPID public key matches
          const currentKey = keyRes.publicKey;
          const subscriptionKey = subscription.options.applicationServerKey;
          
          let keysMatch = false;
          if (subscriptionKey) {
            // Convert ArrayBuffer applicationServerKey to base64url for comparison
            const subscriptionKeyBase64 = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(subscriptionKey))))
              .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            if (subscriptionKeyBase64 === currentKey) {
              keysMatch = true;
            }
          }

          if (!keysMatch) {
            console.log('VAPID key mismatch detected. Unsubscribing old push subscription...');
            await subscription.unsubscribe();
            subscription = null;
          }
        }

        if (!subscription) {
          // Subscribe new device
          const convertedKey = urlBase64ToUint8Array(keyRes.publicKey);
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedKey
          });
          console.log('New device push subscription created.');
        }

        // Upload subscription details to user profile
        await apiRequest('/notifications/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription)
        });
        console.log('Push subscription successfully uploaded to server.');

      } catch (err) {
        console.error('Error setting up PWA push notifications:', err);
      }
    }
  }, []);

  return null;
}
