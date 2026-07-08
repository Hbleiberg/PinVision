// Offline shell: cache-first for same-origin static assets, network-only for
// everything else (the API is cross-origin and identify always needs network).
// VERSION must be bumped in lockstep with js/config.js on every deploy — it
// keys the cache, so stale shells are evicted on activate.
const VERSION = '0.2.0';
const CACHE = `pinvault-shell-${VERSION}`;

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/api.js',
  './js/app.js',
  './js/auth.js',
  './js/collection.js',
  './js/config.js',
  './js/demo.js',
  './js/detail.js',
  './js/form.js',
  './js/identify.js',
  './js/image.js',
  './js/phash.js',
  './js/removed.js',
  './js/util.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Stale-while-revalidate: serve the cached shell instantly, refresh in the
  // background so the next load picks up small changes.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fresh = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});
