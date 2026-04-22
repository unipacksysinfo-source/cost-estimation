// Lite Cost Estimation — Service Worker
const CACHE_NAME = 'lite-cost-est-v1';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

const CDN_CACHE = 'lite-cost-cdn-v1';
const CDN_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com'
];

// ── Install: precache app shell ──────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ───────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== CDN_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: serve from cache, fallback network ─────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isCDN = CDN_HOSTS.some(h => url.hostname.includes(h));

  if (isCDN) {
    // Stale-while-revalidate for CDN (fonts, FA icons, libs)
    event.respondWith(
      caches.open(CDN_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          const fetchPromise = fetch(event.request)
            .then(response => {
              if (response.ok) cache.put(event.request, response.clone());
              return response;
            })
            .catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
  } else {
    // Cache-first for app shell
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => caches.match('/index.html'));
      })
    );
  }
});

// ── Background Sync (optional future use) ────────────────────
self.addEventListener('sync', event => {
  console.log('[SW] Background sync:', event.tag);
});
