// Birla Open Minds Progressive Web App Service Worker
const CACHE_NAME = 'bomis-pwa-cache-v3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // If in dev, preview or cloud run container, bypass service worker completely
  if (
    url.hostname.includes('run.app') ||
    url.hostname.includes('localhost') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/api/') ||
    event.request.mode === 'navigate' ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // Network-first for all other requests
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
