const CACHE_NAME = 'norish-cache-v0.3.0-beta';
const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/apple-touch-icon.png',
  '/mockup-norish.png'
];

// precache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin or API requests
  if (url.origin !== self.location.origin && !url.pathname.startsWith('/api/'))
    return;

  // Skip any non-GET request immediately
  if (request.method !== 'GET') {
    return;
  }

  // API: use network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Next.js build files (scripts/styles): use stale-while-revalidate
  if (
    url.pathname.startsWith('/_next/') ||
    request.destination === 'script' ||
    request.destination === 'style'
  ) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Images: use cache-first
  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request));
    return;
  }
});

// === Strategies ===

async function cacheFirst(req) {
  if (req.method !== 'GET') return fetch(req);
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;

  const fresh = await fetch(req);
  cache.put(req, fresh.clone());
  return fresh;
}

async function networkFirst(req) {
  if (req.method !== 'GET') return fetch(req);
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(req);
    cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(req);
    return cached || new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(req) {
  if (req.method !== 'GET') return fetch(req);
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  const network = fetch(req).then((res) => {
    cache.put(req, res.clone());
    return res;
  });
  return cached || network;
}
