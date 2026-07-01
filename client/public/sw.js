const CACHE_NAME = 'connect-portal-v1';
const ASSETS_TO_CACHE = [
  '/dashboard',
  '/favicon.ico',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => console.log('Error adding assets to cache:', err));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Let network requests pass first, fallback to cache for offline availability
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

// Listen to push broadcasts from the server
self.addEventListener('push', (event) => {
  let data = { title: 'CONNECT Portal', body: 'New transmission received.' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'CONNECT Portal', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: self.location.origin + '/images/Markdot logo black.png',
    badge: self.location.origin + '/favicon.ico',
    data: {
      url: data.url || '/dashboard'
    },
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open', title: 'Open Console' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle clicks on push notifications
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing tab if open, otherwise open new tab
      for (let client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
