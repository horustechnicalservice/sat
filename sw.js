/* Centinela UFO — Service Worker: app shell offline */
const CACHE = 'centinela-v45';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './assets/logo-centinela.png',
  './assets/mapa-sudamerica.jpg'
];
const CDN = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdnjs.cloudflare.com/ajax/libs/satellite.js/4.1.4/satellite.min.js',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/satellite.js@4.1.4/dist/satellite.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  // Network-first for TLE APIs (need freshest data when online)
  if (/tle|celestrak|retlector|ivanstanojevic/i.test(url)) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }
  // Network-first para el HTML (si no, una versión vieja de index.html quedaba pegada en caché y los arreglos nunca llegaban)
  const isPage = event.request.mode === 'navigate' || /\/(index\.html)?(\?.*)?$/.test(new URL(url).pathname);
  if (event.request.method === 'GET' && isPage && new URL(url).origin === self.location.origin) {
    event.respondWith(
      fetch(event.request).then((res) => {
        if (res && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(event.request, copy)).catch(() => {}); }
        return res;
      }).catch(() => caches.match(event.request).then((c) => c || caches.match('./index.html')))
    );
    return;
  }
  // Cache-first for assets + CDN libs
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        const copy = res.clone();
        if (event.request.method === 'GET' && res.status === 200) {
          caches.open(CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    if (self.clients.openWindow) return self.clients.openWindow('./');
  }));
});
