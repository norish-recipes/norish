# Web offline support is a persisted query cache, not a domain database

Offline support (targeting flaky connectivity and backend-down page loads, explicitly not multi-day local-first) persists the TanStack Query cache itself, injected through the shared provider bundle's `getQueryClient` seam, plus a Cache Warmer that prefetches the Warm Set through the normal query layer. We rejected a bespoke IndexedDB domain store (object stores per entity, query-to-scope registry): a prior attempt of that design (`feat/make-web-offline-safe`, ~31k lines including server-side receipt/idempotency machinery) grew unmanageable and created a second source of truth.

**The offline runtime is one engine that web and mobile both run**, in `@norish/shared-react/offline`: the Offline Cache persister, the Outbox and Replay, Recovery, the Cache Warmer and the connectivity probe. A client supplies only its storage adapter and its platform concerns. Web stores in IndexedDB and localStorage and keeps the service worker and the Offline Toggle. Mobile stores in MMKV, with upload files copied into the app's storage. Every adapter must pass the same storage contract suite, so a fix to offline behaviour lands for both clients at once.

**The persisted cache is stored one entry per read** under its owner's prefix, not as one dehydrated blob. A save writes only the reads whose data changed and deletes those that left the cache, at the next idle moment after a short throttle: serialising the whole cache on every save freezes a phone's JS thread for 200–330 ms. A launch restores every entry at once, and the 7-day maxAge counts from the owner's newest save, so a cache in use never loses a warmed read for being unchanged.

A household-scoped write records the household it was made for. The server refuses a write made for another household, and Replay parks it. When the household changes, the client clears the former household's saved reads.

## Consequences

- Offline reads only hit for query keys that were actually fetched; offline search/filtering over cached recipes is degraded by design (a novel search term while Offline finds nothing).
- Content guarantees ("first 50 full recipes") are the Warmer's job, not a schema's.
- Any future query becomes offline-capable by adding it to the warm list — no migrations.
