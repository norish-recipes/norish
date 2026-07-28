import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  IMAGE_CACHE_MAX_AGE_SECONDS,
  IMAGE_CACHE_MAX_ENTRIES,
  IMAGE_CACHE_NAME,
  LEGACY_API_CACHE_NAME,
} from "@/lib/offline/cache-names";
import { defaultCache } from "@serwist/next/worker";
import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Content-hashed precache manifest, injected by @serwist/next at build time.
    // Replaces the hand-rolled `update-sw` version stamp that rotted silently (ADR-0006).
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Same-origin images (recipe photos via /_next/image included), cache-first
    // like the hand-rolled sw.js this replaces — but bounded. The old worker
    // capped nothing; defaultCache's 64-entry image LRUs are below the Warm Set
    // floor (50 recipes × primary image plus grid thumbnails), so recently-viewed
    // recipe images would evict each other (ADR-0006 ports the image caching).
    {
      matcher: ({ request, sameOrigin }) => sameOrigin && request.destination === "image",
      handler: new CacheFirst({
        // Shared name: the Cache Warmer writes warmed primary images here (ADR-0009).
        cacheName: IMAGE_CACHE_NAME,
        plugins: [
          new ExpirationPlugin({
            maxEntries: IMAGE_CACHE_MAX_ENTRIES,
            maxAgeSeconds: IMAGE_CACHE_MAX_AGE_SECONDS,
            maxAgeFrom: "last-used",
          }),
        ],
      }),
    },
    // The API is never cached at the HTTP layer, so an Offline read genuinely
    // fails instead of being answered with something stale. `defaultCache`
    // would otherwise hold same-origin `/api/` GETs under NetworkFirst, which
    // both lies to the connectivity probe and gives reads a second source of
    // truth beside the persisted query cache — see ADR-0006 for what that cost.
    //
    // Serwist routes default to GET, so mutations are unaffected (they were
    // never cached by anything). The 10s ceiling is `defaultCache`'s, kept so
    // its `/api/auth/*` rule — which this one now shadows — behaves as before;
    // the health probe bounds itself at 5s and never reaches it.
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/api/"),
      handler: new NetworkOnly({ networkTimeoutSeconds: 10 }),
    },
    // Everything else keeps Serwist's Next.js-aware defaults: runtime page/RSC
    // caches for visited routes, static assets and fonts.
    ...defaultCache,
  ],
  // Document navigations that fail with no cached copy — a deep link or an
  // unvisited route while Offline — fall back to the precached offline shell
  // instead of the browser's error page (ADR-0006). Non-document requests never
  // match, so the health probe (destination "") can never be answered by a
  // fallback and lied to.
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

// An app installed before the rule above has an `apis` cache full of
// personalized responses that no route reads any more, so nothing expires it
// and sign-out does not clear it (ADR-0005). Deleting a cache that isn't there
// is a no-op, so this needs no one-shot guard — it does real work on the
// activation that replaces such a worker and nothing on every later one.
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.delete(LEGACY_API_CACHE_NAME).catch(() => false));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }

      return self.clients.openWindow("/");
    })
  );
});

serwist.addEventListeners();
