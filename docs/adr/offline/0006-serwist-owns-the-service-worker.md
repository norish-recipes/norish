# Serwist owns the service worker

Offline page loads require navigation fallback to a cached App Shell, and App Router soft navigations additionally fetch RSC payloads — machinery we chose to adopt via `@serwist/next` rather than extend the hand-rolled `sw.js`. Deciding precedent: the repo already tried owning SW versioning and it rotted silently — the `update-sw` pipeline became a no-op, serving a `v0.3.0-beta`-named cache to a `0.19.x` app for sixteen releases; Serwist's content-hashed precache manifest makes that entire class of failure structurally impossible (nothing to bump). Custom behaviour (notification-click handling, excluding the API from caching, image runtime caching) lives on as custom worker code inside the Serwist build.

The API exclusion started as `/api/v1/health` only, so connectivity probes couldn't be lied to. It was widened on July 28, 2026 to all same-origin `/api/` GETs, because `defaultCache` was answering _any_ offline read from its `apis` NetworkFirst store — tRPC queries travel over GET, so a batch fetched while Live came back Offline as a success carrying pre-mutation data, which silently reverted a queued grocery check-off. Reads have one offline source of truth: the persisted query cache (ADR-0001). An HTTP-level copy is a second one, and it lies about liveness rather than failing.

## Consequences

- The `update-sw` script, turbo task, and build step are deleted, along with the hand-rolled `sw.js`.
- After a deploy, a user opening the app offline gets the previous shell until they next load it while Live — inherent to service workers, accepted.
