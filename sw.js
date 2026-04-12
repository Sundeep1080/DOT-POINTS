/* ═══════════════════════════════════════════════════════
   IRAVAT · SALT — Service Worker v9
   Cache-first for app shell, network-first for data
═══════════════════════════════════════════════════════ */

const CACHE_NAME    = 'iravat-v9';
const SHELL_CACHE   = 'iravat-shell-v9';

// App shell — these are cached on install and served offline
const SHELL_ASSETS = [
  './iravat_v9.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
];

// ── Install: cache app shell ──
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => {
      // Cache what we can, skip failures (fonts may fail offline)
      return Promise.allSettled(
        SHELL_ASSETS.map(url =>
          cache.add(url).catch(() => console.log('SW: skipped', url))
        )
      );
    })
  );
});

// ── Activate: clean old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== SHELL_CACHE)
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for shell, network-first for everything else ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always fetch CSV uploads from network — never cache user data
  if (url.pathname.includes('.csv')) return;

  // Shell assets — cache first
  if (SHELL_ASSETS.some(a => event.request.url.includes(a.replace('./',''))) ||
      url.pathname.endsWith('.html') ||
      url.pathname.endsWith('.json') ||
      url.pathname.endsWith('sw.js')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200) return response;
          const clone = response.clone();
          caches.open(SHELL_CACHE).then(c => c.put(event.request, clone));
          return response;
        }).catch(() => caches.match('./iravat_v9.html'));
      })
    );
    return;
  }

  // External resources (fonts, icons) — stale-while-revalidate
  if (url.hostname !== self.location.hostname) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Default — network with cache fallback
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// ── Background sync message handler ──
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
