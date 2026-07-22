import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
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
    // The connectivity runtime decides Live vs Offline by probing `/api/v1/health`.
    // A cached 200 would lie to that probe, so the health route is never cached — it
    // must always hit the network or genuinely fail (ADR-0006, ADR-0005).
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname === "/api/v1/health",
      handler: new NetworkOnly(),
    },
    // Same-origin images (recipe photos via /_next/image included), cache-first
    // like the hand-rolled sw.js this replaces — but bounded. The old worker
    // capped nothing; defaultCache's 64-entry image LRUs are below the Warm Set
    // floor (50 recipes × primary image plus grid thumbnails), so recently-viewed
    // recipe images would evict each other (ADR-0006 ports the image caching).
    {
      matcher: ({ request, sameOrigin }) => sameOrigin && request.destination === "image",
      handler: new CacheFirst({
        cacheName: "norish-images",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 512,
            maxAgeSeconds: 30 * 24 * 60 * 60,
            maxAgeFrom: "last-used",
          }),
        ],
      }),
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
