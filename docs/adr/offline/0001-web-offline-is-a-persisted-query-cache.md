# Web offline support is a persisted query cache, not a domain database

Web offline support (targeting flaky connectivity and backend-down page loads, explicitly not multi-day local-first) persists the TanStack Query cache itself to IndexedDB — injected through the shared provider bundle's `getQueryClient` seam, mirroring the mobile app's proven MMKV pattern — plus a Cache Warmer that prefetches the Warm Set through the normal query layer. We rejected a bespoke IndexedDB domain store (object stores per entity, query-to-scope registry): a prior attempt of that design (`feat/make-web-offline-safe`, ~31k lines including server-side receipt/idempotency machinery) grew unmanageable and created a second source of truth.

## Consequences

- Offline reads only hit for query keys that were actually fetched; offline search/filtering over cached recipes is degraded by design (a novel search term while Offline finds nothing).
- Content guarantees ("first 50 full recipes") are the Warmer's job, not a schema's.
- Any future query becomes offline-capable by adding it to the warm list — no migrations.

## Amended November 2026: one engine, storage per client

The offline runtime is one engine in `@norish/shared-react/offline` that web and mobile both run: the Offline Cache persister, the Outbox and Replay, Recovery, the Cache Warmer and the connectivity probe. A client supplies only its storage adapter and its platform concerns. Web stores in IndexedDB and localStorage and keeps the service worker and the Offline Toggle. Mobile stores in MMKV, with upload files copied into the app's storage. Every adapter must pass the same storage contract suite, so a fix to offline behaviour lands for both clients at once.
