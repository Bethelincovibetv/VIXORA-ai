importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

firebase.initializeApp({
  projectId: "refreshing-rune-454812-q8",
  appId: "1:386135102110:web:334e9b26db398a5698618f",
  apiKey: "AIzaSyBWYvA98usL-Mdz0Lm9HtPqtPtfrt1x2Wc",
  authDomain: "refreshing-rune-454812-q8.firebaseapp.com",
  messagingSenderId: "386135102110",
  storageBucket: "refreshing-rune-454812-q8.firebasestorage.app"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || payload.data?.title || '🚀 Vixora New Feature Update!';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.message || 'A new update and feature advert was released in Vixora AI Studio!',
    icon: '/icon-192.jpg',
    badge: '/icon-192.jpg',
    vibrate: [200, 100, 200, 100, 200],
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
