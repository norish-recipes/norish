## Why

Norish already preserves offline mutations in a durable web outbox, but the web application still loses its useful read state across a cold offline PWA launch because the web query cache is memory-only and the service worker has no safe authenticated app-shell strategy. The existing outbox diagnostic surface is also not discoverable or aligned with the HeroUI v3 web UI, while the service worker's generic API GET cache is too broad for personalized offline data.

## What Changes

- Add a user- and origin-scoped persisted web read cache for:
  - the canonical first 100 recipe dashboard summaries;
  - up to 50 complete recipe details, prioritizing recipes planned in the current week;
  - dashboard thumbnail images only; when a thumbnail URL is also the recipe's main hero URL, that same cached resource serves both views;
  - the current local calendar week;
  - groceries, recurring groceries, and recipe-name mappings.
- Restore valid cached read data during offline PWA startup and expose freshness, cache scope, schema version, partial hydration, and storage-quota outcomes.
- Add a safe offline app-shell/bootstrap path without weakening the server-side authentication proxy or treating cached identity as authorization.
- Replace the raw, fixed `WebOutboxStatus` diagnostic panel with a discoverable HeroUI v3 avatar indicator and queue view.
- Show the active offline queue count, retrying work, and terminal/quarantined items requiring attention.
- Make offline/backend-unreachable status take precedence over the existing update-available dot in the user avatar.
- Tighten service-worker caching to avoid generic personalized API GET caching; keep only explicitly safe static, shell, and dashboard-thumbnail media behavior.
- Preserve the completed web mutation outbox as the write-side foundation and keep its replay behavior unchanged.
- Document closed-PWA/background mutation replay as deferred because browser lifecycle guarantees are unreliable; no service-worker mutation replay is part of this change.

## Capabilities

### New Capabilities

- `web-offline-read-cache`: Scoped persisted read snapshots, bounded full-recipe hydration, offline shell/bootstrap, freshness, and storage-pressure behavior for recipes, the current week, and groceries.
- `web-offline-status`: Connectivity-priority avatar status, HeroUI v3 queue indicator, discoverable queue details, and actionable pending-delivery diagnostics.

### Modified Capabilities

<!-- Existing mutation-outbox requirements remain unchanged; this change only replaces its web presentation surface. -->

## Impact

- `apps/web`: service worker, app bootstrap/providers, navbar user menu, offline read-cache integration, translations, and tests.
- `packages/shared-react`: persisted-query/read-cache support and reusable outbox status/diagnostic hooks where shared ownership is appropriate.
- `@tanstack/query-persist-client-core` or an equivalent IndexedDB persister may become a web dependency, reusing the mobile persistence precedent without sharing mobile storage code.
- No new server API or database schema is required for the core read-cache and status behavior.
- Mobile behavior remains out of scope.
