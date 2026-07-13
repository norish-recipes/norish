## 1. Read-cache foundation

- [ ] 1.1 Confirm the canonical web query keys and current-local-week calculation for recipes, calendar items, and groceries, and record the selected scope metadata contract.
- [ ] 1.2 Add a separate IndexedDB read-cache database with schema versioning, origin/user/household scope metadata, timestamps, hydration state, and storage outcome records.
- [ ] 1.3 Add a web IndexedDB persister or adapter for the TanStack Query persistence core, with successful-query-only dehydration and an explicit allowlist for offline query data.
- [ ] 1.4 Add restore gating so compatible persisted data is available before authenticated query consumers render, while the application shell remains responsive during restoration.
- [ ] 1.5 Add cache invalidation/isolation for backend-origin changes, confirmed sign-out, user changes, household membership changes, and cache-schema changes.
- [ ] 1.6 Add unit tests for scope matching, schema invalidation, restore failure fallback, successful-only persistence, and cache clearing.

## 2. Canonical offline data hydration

- [ ] 2.1 Persist the canonical first 100 unfiltered default recipe dashboard summaries with ordering and freshness metadata.
- [ ] 2.2 Add an explicit current local Monday-to-Sunday calendar query/snapshot for planned meals, independent of whatever calendar range is currently visible.
- [ ] 2.3 Persist the grocery snapshot including groceries, recurring groceries, recipe-name mappings, and freshness metadata.
- [ ] 2.4 Add bounded full-recipe hydration for up to 50 complete `recipes.get` records, prioritizing current-week planned recipes and then the remaining canonical recipe order.
- [ ] 2.5 Track per-recipe hydration success, interruption, terminal failure, and quota failure so incomplete details are not reported as offline-ready.
- [ ] 2.6 Add freshness, last-synced, partial-hydration, and storage-pressure state to the read-cache API used by the web UI.
- [ ] 2.7 Add focused tests for canonical snapshots, planned-recipe prioritization, the 50-detail budget, interruption recovery, and truthful quota handling.

## 3. Offline bootstrap and service-worker cache boundaries

- [ ] 3.1 Define and cache a safe application shell plus deterministic offline fallback without bypassing the Next.js authentication proxy.
- [ ] 3.2 Add offline bootstrap behavior that restores compatible render identity and read snapshots for rendering only, while leaving server authorization authoritative.
- [ ] 3.3 Remove or narrow the generic `/api/` GET cache to explicitly safe resources and cache only dashboard thumbnail images; reuse that cached response when the thumbnail is also the main hero image, with distinct hero/gallery/avatar/video/other images excluded.
- [ ] 3.4 Add navigation, cache-policy, no-shell, personalized-response, and dashboard-thumbnail media regression tests for the service worker behavior.
- [ ] 3.5 Verify cached offline data is not exposed as server-confirmed current data and that online startup revalidates asynchronously.

## 4. HeroUI v3 connectivity and queue status

- [ ] 4.1 Add a web connectivity state model that combines browser reachability and observed HTTP backend reachability without treating lazy WebSocket `idle` as offline.
- [ ] 4.2 Expose a reusable status/diagnostics hook that combines connectivity state with active outbox counts, retrying entries, attention entries, and retained results.
- [ ] 4.3 Replace the raw fixed `WebOutboxStatus` panel with a HeroUI v3 avatar indicator using `Badge.Anchor`, semantic status colors, and accessible labels.
- [ ] 4.4 Add an explicit `Offline queue` entry to the existing user menu and a HeroUI v3 Modal or Drawer queue view using compound components and `onPress` handlers.
- [ ] 4.5 Implement status precedence: yellow offline/backend-unreachable dot, queue attention, active queue count, update dot, then no indicator.
- [ ] 4.6 Show `pending + retrying` as active queued work and report quarantined, terminal, and expired entries separately as attention items.
- [ ] 4.7 Add cross-tab diagnostics refresh and event handling so queue counts stay consistent across open Norish windows.
- [ ] 4.8 Add translations and accessibility tests for offline, backend-unreachable, queued, retrying, attention, and clean states.
- [ ] 4.9 Add component tests covering avatar badge priority, queue count visibility, queue view opening, keyboard access, and removal of the raw fixed-panel behavior.

## 5. Outbox integration, documentation, and validation

- [ ] 5.1 Verify read-cache restore and reconnect ordering preserve the existing outbox-first replay and authoritative refetch behavior without changing mutation-outbox semantics.
- [ ] 5.2 Add integration tests for offline mutation plus reload, cached reads plus reload, user/origin scope isolation, unauthorized replay quarantine, and reconnect convergence.
- [ ] 5.3 Document that closed-PWA/background mutation replay is deferred, that the service worker does not own the mutation outbox, and that next-launch replay is the supported fallback.
- [ ] 5.4 Keep mobile, server API, database schema, Background Sync, and generic arbitrary-query persistence explicitly out of the implementation.
- [ ] 5.5 Run the focused web/shared-react tests, service-worker checks, typecheck, lint, format check, and OpenSpec validation for the completed change.
