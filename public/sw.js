// Service Worker for Pizza Citizen Portal
// Caches images and static assets to eliminate redundant server queries and speed up rendering.
const CACHE_NAME = 'gvvr-image-cache-v1';
const MAX_IMAGE_ENTRIES = 120;

// Patterns of image endpoints and static assets to cache
const IMAGE_PATTERNS = [
  /\/api\/media/,
  /\/api\/wiki-image/,
  /\/api\/timeline-image/,
  /\/api\/vehicle-image/,
  /ui-avatars\.com/,
  /fandom\.com/,
  /roblox\.com/,
  /\.(png|jpe?g|webp|svg|gif|ico)(\?.*)?$/i
];

// URLs that must NEVER be intercepted/cached by SW
const EXCLUDE_PATTERNS = [
  /\/api\/dm/,
  /\/api\/notifications/,
  /\/api\/vehicles/,
  /\/api\/applications/,
  /\/api\/auth/,
  /\/api\/push-token/,
  /\/api\/user-presence/,
  /\/api\/admin-stats/
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = request.url;

  // Never intercept dynamic/stateful APIs
  if (EXCLUDE_PATTERNS.some((pattern) => pattern.test(url))) {
    return;
  }

  // Handle Images with Cache-First / Stale-While-Revalidate strategy
  const isImage = IMAGE_PATTERNS.some((pattern) => pattern.test(url));
  if (isImage) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          // Revalidate in background without blocking
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
          }).catch(() => {});
          return cachedResponse;
        }

        // Cache miss: fetch from network and store
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
            trimCache(cache, MAX_IMAGE_ENTRIES);
          }
          return networkResponse;
        } catch (err) {
          return cachedResponse || new Response('Offline', { status: 503 });
        }
      })
    );
  }
});

async function trimCache(cache, maxItems) {
  try {
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      for (let i = 0; i < keys.length - maxItems; i++) {
        await cache.delete(keys[i]);
      }
    }
  } catch {}
}
