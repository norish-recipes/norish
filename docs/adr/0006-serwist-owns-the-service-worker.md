# Serwist owns the service worker

Offline page loads require navigation fallback to a cached App Shell, and App Router soft navigations additionally fetch RSC payloads — machinery we chose to adopt via `@serwist/next` rather than extend the hand-rolled `sw.js`. Deciding precedent: the repo already tried owning SW versioning and it rotted silently — the `update-sw` pipeline became a no-op, serving a `v0.3.0-beta`-named cache to a `0.19.x` app for sixteen releases; Serwist's content-hashed precache manifest makes that entire class of failure structurally impossible (nothing to bump). Custom behaviour (notification-click handling, excluding `/api/v1/health` from caching so connectivity probes can't be lied to, image runtime caching) lives on as custom worker code inside the Serwist build.

## Consequences

- The `update-sw` script, turbo task, and build step are deleted, along with the hand-rolled `sw.js`.
- After a deploy, a user opening the app offline gets the previous shell until they next load it while Live — inherent to service workers, accepted.
