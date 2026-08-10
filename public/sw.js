const CACHE_NAME = 'vixora-pwa-v2';
const ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.jpg',
  '/icon-512.jpg',
  '/vixora_logo.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => 
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// PostMessage handler from React app to show phone native notifications
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const title = event.data.title || '🚀 Vixora New Feature Update!';
    const options = {
      body: event.data.body || 'Open Vixora to see what was newly updated!',
      icon: '/icon-192.jpg',
      badge: '/icon-192.jpg',
      vibrate: [200, 100, 200, 100, 200],
      tag: 'vixora-update-' + Date.now(),
      renotify: true,
      data: event.data.data || {}
    };
    self.registration.showNotification(title, options);
  }
});

self.addEventListener('push', (event) => {
  let payload = { title: '🚀 Vixora Feature Update Advert!', message: 'A new feature update announcement was released on Vixora.' };
  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch (e) {
    if (event.data) payload.message = event.data.text();
  }

  const title = payload.title || payload.notification?.title || '🚀 Vixora New Feature Update!';
  const options = {
    body: payload.message || payload.body || payload.notification?.body || 'Open Vixora Studio to check out the new feature!',
    icon: '/icon-192.jpg',
    badge: '/icon-192.jpg',
    vibrate: [200, 100, 200, 100, 200],
    data: payload
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
