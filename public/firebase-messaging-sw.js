importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBVfxez03LudcN4YzFeDpBD8AvQ_0HhXfo",
  authDomain: "deac-monitor.firebaseapp.com",
  projectId: "deac-monitor",
  storageBucket: "deac-monitor.firebasestorage.app",
  messagingSenderId: "721222526794",
  appId: "1:721222526794:web:a27fd0a5be737f815983b3"
});

const messaging = firebase.messaging();
const DEAC_URL = 'https://www.gcmdeac.prefeitura.sp.gov.br';

messaging.onBackgroundMessage(payload => {
  const d = payload.data || {};
  const n = payload.notification || {};
  self.registration.showNotification(d.title || n.title || 'DEAC Monitor', {
    body: d.body || n.body || 'Nova vaga disponível!',
    icon: 'https://drive.prefeitura.sp.gov.br/cidade/secretarias/upload/logo%20gcm.png',
    badge: 'https://drive.prefeitura.sp.gov.br/cidade/secretarias/upload/logo%20gcm.png',
    data: { url: d.url || DEAC_URL },
    vibrate: [200, 100, 200],
    requireInteraction: true,
  });
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || DEAC_URL;
  e.waitUntil(clients.matchAll({ type: 'window' }).then(list => {
    for (const c of list) { if (c.url === url && 'focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));
