## Why

Norish's web mutation outbox now preserves offline write intent, but the installed PWA still cannot reliably reopen into a personalized offline experience. Query data is currently memory-only, the service worker does not provide an authenticated app-shell fallback, and queued mutations are not delivered while the PWA is completely closed.

This change makes the web PWA useful without a live backend: it restores a user-scoped offline shell and read cache, keeps full recipe content available, exposes clear connectivity and queue state, and adds a separately gated plan and implementation for service-worker background delivery.

## What Changes

- Add a user- and backend-origin-scoped persistent web read cache backed by IndexedDB.
- Restore cached data before authenticated query consumers render, then revalidate in the background when the backend is reachable.
- Cache the canonical first 100 recipes as full recipe detail records, including the metadata needed to render ingredients, steps, nutrition, and recipe media references.
- Cache the current week's planned meals and the household grocery list, with explicit freshness metadata and stale-data presentation.
- Add an offline app-shell/navigation fallback so an installed PWA can reopen while the origin is offline instead of being redirected by the server-side auth proxy.
- Preserve a last-confirmed offline user/session identity for rendering only; server authentication remains authoritative for replay and writes.
- Add a compact reachability indicator to the user avatar. Connectivity status takes priority over the existing update-available indicator.
- Add an interactive queue view showing queued, retrying, quarantined, terminal, expired, and completed-delivery states with retry/discard actions where safe.
- Add cross-tab and service-worker coordination for cache and outbox status changes.
- Add a separate closed-PWA background-delivery task using service-worker Background Sync where supported, with next-app-open replay as the correctness fallback.
- Do not reopen or modify the completed `add-web-offline-mutation-delivery` change; reuse its operation IDs, receipts, FIFO ordering, user scoping, and reconnect refetch behavior.

## Capabilities

### New Capabilities

- `web-offline-read-cache`: Offline app-shell boot, last-confirmed user rendering, and persistent full-recipe, weekly-meal-plan, and grocery snapshots.
- `web-offline-status`: User-avatar connectivity priority, queue counts, detailed queued-operation diagnostics, and recovery actions.
- `web-offline-background-sync`: A separately planned and gated service-worker path for replaying the existing outbox while an installed PWA is completely closed.

### Modified Capabilities

- None. The existing mutation-delivery capability remains the server-authoritative write and idempotency foundation.

## Impact

- `apps/web`: service-worker navigation fallback, offline bootstrap, cache hydration, reachability state, avatar indicator, and queue panel.
- `packages/shared-react`: web-compatible persistent query-cache and cross-context coordination adapters where appropriate, without changing mobile behavior implicitly.
- IndexedDB: new persisted query-cache stores and metadata, isolated from mutation outbox retention and schema migrations.
- Service worker: authenticated-shell fallback, optional Background Sync registration, worker-safe outbox replay, and client notification messages.
- Auth/session handling: offline rendering identity and reconnect revalidation without treating cached identity as authorization.
- Recipe media: explicit offline storage/eviction policy for images and other media referenced by the 100 full recipe records.
- Tests and documentation: cold offline PWA boot, full recipe hydration, storage quota/eviction, user isolation, avatar priority, closed-PWA replay, unsupported-browser fallback, and cross-context race coverage.
