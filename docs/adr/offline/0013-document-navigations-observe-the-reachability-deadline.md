# Document navigations observe the Reachability Deadline

A cold launch over a slow-but-alive network hung on the iOS startup image indefinitely: Serwist's `defaultCache` serves documents with `NetworkFirst` and no timeout, and the `/~offline` navigation fallback (ADR-0006) only fires when the request *errors* — a crawling network never errors, it just crawls. Adding `networkTimeoutSeconds` is not enough: on timeout the strategy answers from cache, but with no cached copy it goes back to waiting on the network, so exactly the launch that most needs bounding (an unvisited route) stays unbounded.

We decided that document navigations observe the same five-second Reachability Deadline as the health probe — one definition of "the backend is unreachable" everywhere (CONTEXT.md). A custom handler in `sw.ts` shadows the default document strategy: it races the navigation (the preload request when available, else its own abortable fetch) against the deadline; past it, a visited route serves its cached copy and an uncached route throws into the existing fallback, whose bootstrap renders the Warm Set surface or the explicit Offline-unavailable state. The trade-off is deliberate: a network that would have delivered in six seconds now paints cached-or-offline at five — boundedness over freshness, because the Warm Set surfaces refetch into live data on their own the moment the probe succeeds, and the Offline-unavailable card auto-reloads once when Live returns.

## Consequences

- The deadline constant lives in `lib/connectivity/reachability.ts`, imported by both the probe and the service worker; changing the deadline changes both verdicts at once, by design.
- The custom handler owns writing documents into the `pages` cache (with a manual size cap replacing the strategy's `ExpirationPlugin`); `cacheOnNavigation` and the RSC strategies are untouched, so in-app soft navigations keep today's behavior.
- The navigation preload request cannot be aborted at the deadline — it is merely no longer awaited; the browser discards it when it lands.
