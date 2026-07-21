import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { defaultCache } from "@serwist/next/worker";
import { NetworkOnly, Serwist } from "serwist";

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
    // Everything else keeps Serwist's Next.js-aware defaults: the app-shell navigation
    // fallback, RSC payloads, static assets, fonts and cache-first images.
    ...defaultCache,
  ],
});

// Ported from the hand-rolled sw.js: a cooking-timer notification focuses an existing
// Norish window if one is open, otherwise opens the app.
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
