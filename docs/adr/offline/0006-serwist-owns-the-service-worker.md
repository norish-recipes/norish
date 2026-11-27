# Serwist owns the service worker

Offline page loads require a navigation fallback to a cached App Shell, and App Router soft navigations additionally fetch RSC payloads — machinery we adopt from Serwist rather than hand-rolling a `sw.js`. Turbopack has no plugin API, so `@serwist/turbopack` builds `app/sw.ts` in a `force-static` route served at `/serwist/sw.js`. Deciding precedent: the repo once owned SW versioning itself and it rotted silently — the `update-sw` pipeline became a no-op, serving a `v0.3.0-beta`-named cache to a `0.19.x` app for sixteen releases; Serwist's content-hashed precache manifest makes that entire class of failure structurally impossible (nothing to bump). Custom behaviour (notification-click handling, excluding the API from caching, image runtime caching) is custom worker code inside the Serwist build.

A document navigation with no cached copy — a deep link or an unvisited route while Offline — falls back to the precached `/~offline` shell. The shell embeds no user data; its client bootstrap mounts the normal providers and renders the requested Warm Set surface from the persisted cache, or the explicit Offline-unavailable state (ADR-0009). Same-origin images are cache-first in one bounded cache, which the Cache Warmer also fills with each warmed recipe's primary image.

The worker never caches same-origin `/api/` GETs, the health probe included, so connectivity probes can't be lied to and an Offline read genuinely fails. Serwist's `defaultCache` would answer any offline read from its `apis` NetworkFirst store — tRPC queries travel over GET, so a batch fetched while Live would come back Offline as a success carrying pre-mutation data, silently reverting a queued grocery check-off. Reads have one offline source of truth: the persisted query cache (ADR-0001). An HTTP-level copy is a second one, and it lies about liveness rather than failing.

## Consequences

- There is no `update-sw` script, turbo task or build step, and no hand-rolled `sw.js`.
- After a deploy, a user opening the app offline gets the previous shell until they next load it while Live — inherent to service workers, accepted.
