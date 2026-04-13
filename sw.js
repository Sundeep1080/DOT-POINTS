/* ═══════════════════════════════════════════════════════
   IRAVAT · SALT — Service Worker v9
   Scoped to /DOT-POINTS/ on GitHub Pages
═══════════════════════════════════════════════════════ */

const CACHE_NAME = 'iravat-v9-shell';
const BASE       = '/DOT-POINTS/';

const SHELL_ASSETS = [
  BASE,
  BASE + 'iravat_v9.html',
  BASE + 'manifest.json',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png',
];

// ── Install ──
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(
        SHELL_ASSETS.map(url =>
          cache.add(url).catch(e => console.log('SW skip:', url, e.message))
        )
      )
    )
  );
});

// ── Activate: remove old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept CSV uploads
  if (url.pathname.endsWith('.csv') || url.pathname.endsWith('.txt')) return;

  // Same-origin requests: cache-first, revalidate in background
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        // Background revalidation
        const fetchFresh = fetch(event.request).then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(c => c.put(event.request, response.clone()));
          }
          return response;
        }).catch(() => null);

        return cached || fetchFresh.then(r => r || caches.match(BASE + 'iravat_v9.html'));
      })
    );
    return;
  }

  // Cross-origin (Google Fonts, Font Awesome): stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fresh = fetch(event.request).then(response => {
        if (response && response.status === 200) {
          caches.open(CACHE_NAME).then(c => c.put(event.request, response.clone()));
        }
        return response;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
