// Birla Open Minds Progressive Web App Service Worker
const CACHE_NAME = 'bomis-pwa-cache-v4';

self.addEventListener('install', () => {
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

  // Never intercept dev/preview, APIs, HTML navigation, or external Google/Firestore traffic
  if (
    url.hostname.includes('run.app') ||
    url.hostname.includes('localhost') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/api/') ||
    event.request.mode === 'navigate' ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // Strictly network-first for static assets only
  event.respondWith(
    fetch(event.request, { cache: 'no-store' }).catch(() => caches.match(event.request))
  );
});
