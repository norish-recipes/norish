import type { PrecacheEntry, SerwistGlobalConfig, StrategyHandler } from "serwist";
import { REACHABILITY_DEADLINE_MS } from "@/lib/connectivity/reachability";
import { SW_ARCHIVE_DOWNLOAD_PATH } from "@/lib/export/archive-download-protocol";
import {
  acceptArchiveDownload,
  respondWithArchiveDownload,
} from "@/lib/export/sw-archive-download";
import {
  IMAGE_CACHE_MAX_AGE_SECONDS,
  IMAGE_CACHE_MAX_ENTRIES,
  IMAGE_CACHE_NAME,
  LEGACY_API_CACHE_NAME,
} from "@/lib/offline/cache-names";
import { defaultCache, PAGES_CACHE_NAME } from "@serwist/turbopack/worker";
import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist, Strategy } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Content-hashed precache manifest, injected by @serwist/turbopack at build time.
    // Replaces the hand-rolled `update-sw` version stamp that rotted silently (ADR-0006).
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Parity with the ExpirationPlugin cap the defaultCache page strategy carried;
// the hand-rolled put below must bound the cache itself.
const DOCUMENT_CACHE_LIMIT = 32;

async function cacheDocument(request: Request, response: Response) {
  const cache = await caches.open(PAGES_CACHE_NAME.html);

  await cache.put(request, response);
  const keys = await cache.keys();

  if (keys.length > DOCUMENT_CACHE_LIMIT) {
    await Promise.all(
      keys.slice(0, keys.length - DOCUMENT_CACHE_LIMIT).map((key) => cache.delete(key))
    );
  }
}

/**
 * Document navigations observe the Reachability Deadline (ADR-0013).
 *
 * Serwist's NetworkFirst has no timeout for documents, and its fallback only
 * fires on a network *error* — so a cold launch over a slow-but-alive network
 * hangs on the iOS startup image indefinitely. Past the deadline, a visited
 * route serves its cached copy and an uncached one fails over to the
 * precached offline shell (via `fallbacks`), whose bootstrap renders the Warm
 * Set surface or the explicit Offline-unavailable state. In-app soft
 * navigations are RSC fetches, not documents, and keep the default
 * strategies.
 *
 * A Strategy subclass, not a plain handler function, deliberately: Serwist
 * injects its fallback plugin only into `runtimeCaching` handlers that are
 * `instanceof Strategy` — a function handler's throw would surface as the
 * browser's error page instead of the offline shell.
 */
class ReachabilityDeadlineDocuments extends Strategy {
  async _handle(request: Request, handler: StrategyHandler): Promise<Response> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { event } = handler;

    const network = (async () => {
      // The navigation preload request (navigationPreload: true) *is* the
      // network attempt for documents; issuing a second fetch would double
      // every page load. It cannot be aborted — past the deadline it is
      // merely no longer awaited.
      const preloaded =
        "preloadResponse" in event
          ? ((await (event as FetchEvent).preloadResponse) as Response | undefined)
          : undefined;

      if (preloaded) return preloaded;

      return fetch(request, { signal: controller.signal });
    })();

    const outcome = await Promise.race([
      network.then(
        (response) => ({ kind: "response" as const, response }),
        () => ({ kind: "unreachable" as const })
      ),
      new Promise<{ kind: "deadline" }>((resolve) => {
        timer = setTimeout(() => resolve({ kind: "deadline" }), REACHABILITY_DEADLINE_MS);
      }),
    ]);

    if (outcome.kind === "response") {
      clearTimeout(timer);
      if (outcome.response.ok) {
        handler.waitUntil(cacheDocument(request, outcome.response.clone()));
      }

      return outcome.response;
    }

    clearTimeout(timer);
    controller.abort();
    const cache = await caches.open(PAGES_CACHE_NAME.html);
    const cached = await cache.match(request);

    if (cached) return cached;

    // An Error instance, deliberately: the injected fallback plugin fires on
    // handlerDidError and answers with the precached /~offline shell.
    throw new Error(`Document navigation missed the reachability deadline: ${request.url}`);
  }
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // First, so nothing downstream can claim a handed-off archive download —
    // in particular the document strategy below, which a hidden frame's
    // navigation would otherwise reach. Answered entirely from memory; this
    // path has no server behind it (see archive-download-protocol.ts).
    {
      matcher: ({ url, sameOrigin }) =>
        sameOrigin && url.pathname.startsWith(SW_ARCHIVE_DOWNLOAD_PATH),
      handler: async ({ url }) =>
        respondWithArchiveDownload(url.pathname) ??
        new Response("Not an archive download", { status: 404 }),
    },
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/export/"),
      handler: new NetworkOnly(),
    },
    // Documents race the network against the Reachability Deadline; shadows
    // defaultCache's NetworkFirst-without-timeout for navigations (ADR-0013).
    {
      matcher: ({ request, sameOrigin }) => sameOrigin && request.destination === "document",
      handler: new ReachabilityDeadlineDocuments({ cacheName: PAGES_CACHE_NAME.html }),
    },
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

// A page handing over an export response body to be streamed out as a
// download. Additive to Serwist's own message listener — message events are
// delivered to every listener, so returning false here simply leaves the
// message to the others.
self.addEventListener("message", (event) => {
  acceptArchiveDownload(event.data);
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
