## 1. Read-cache storage foundation

- [x] 1.1 Add web-owned read-cache types for scope metadata, record kinds, exact query identities, timestamps, persistence warnings, and inventory summaries under `apps/web/lib/offline-read-cache`.
- [x] 1.2 Implement the versioned `norish-web-read-cache` IndexedDB opener with separate `scopes` and `records` stores and upgrade/blocked/error handling.
- [x] 1.3 Implement atomic scope and record reads/writes so failed or aborted transactions preserve the previous successful record.
- [x] 1.4 Implement per-scope lookup, active-scope clearing, schema/origin/user/household compatibility checks, and last-confirmed render-scope selection.
- [x] 1.5 Implement recipe-detail last-access tracking and eviction beyond 50 records without evicting canonical dashboard, calendar, grocery, or store records.
- [x] 1.6 Implement inventory aggregation for recipe summaries/details, calendar items, groceries, recurring groceries, stores, timestamps, last live success, and persistence warnings.
- [x] 1.7 Add same-tab and `BroadcastChannel` read-cache change notifications for commits, clears, scope changes, and warnings.
- [x] 1.8 Add fake-IndexedDB tests for first open, schema upgrade, scope isolation, atomic replacement, interrupted writes, quota/blocked failures, LRU eviction, summary counts, and active-scope-only clearing.

## 2. HTTP connectivity and outbox coordination

- [x] 2.1 Add a web connectivity runtime/store with `checking`, `online`, `offline`, and `backend-unreachable`, monotonic outcome timestamps, browser event handling, and single-flight recovery checks.
- [x] 2.2 Extend the shared tRPC link factory with an injectable transport fetch adapter while preserving the current default behavior for other consumers.
- [x] 2.3 Implement the web transport adapter so HTTP successes and classified transport/502/503/504 failures update connectivity without using lazy WebSocket state.
- [x] 2.4 Implement the development-only persistent backend-unavailable override at the transport boundary and prove production builds ignore stored override state.
- [x] 2.5 Split outbox scope resolution into last-confirmed capture identity and live-session replay identity so cached render identity can label a queued write but cannot authorize replay.
- [x] 2.6 Replace the five-second outbox auth polling loop with startup, browser-online, explicit-recovery, and outbox-change triggers while keeping replay single-flight.
- [x] 2.7 Add connectivity-aware read retry/focus policies without globally pausing mutations before they can reach the outbox link.
- [x] 2.8 Add shared-provider and outbox integration tests for HTTP outcome classification, simulator link ordering, offline mutation capture, live-only replay scope, recovery triggers, and replay-before-refetch ordering.

## 3. Live-first provider and query integration

- [x] 3.1 Add `OfflineWebProvider` inside the existing QueryClient/tRPC tree and outside the app user/household contexts, with the `probing-live`, `loading-fallback`, `cached`, `unavailable`, `recovering`, and `live` phases.
- [x] 3.2 Start the normal live session and screen queries immediately, prepare only IndexedDB metadata in parallel, and enforce the 2.5-second fallback deadline without aborting a late useful live response.
- [x] 3.3 Add a session bridge that prefers Better Auth live state and uses minimal cached user/household metadata only as explicitly render-only fallback after reachability failure.
- [x] 3.4 Build the allowlist registry from real tRPC query helpers for the default 100-recipe dashboard, normally loaded `recipes.get` details, the latest calendar range, `groceries.list`, and `stores.list`.
- [x] 3.5 Subscribe to successful QueryCache updates and persist complete allowlisted records with throttling, while excluding errors, partial/pending data, transient filters, admin/auth, and public/share queries.
- [x] 3.6 Restore compatible records with `queryClient.setQueryData` under their stored exact keys only after a qualifying live failure/deadline, and ensure a late successful live result wins.
- [x] 3.7 Keep the existing recipe, detail, calendar, and grocery skeletons during the live attempt, then add explicit unavailable-offline outcomes when fallback has no matching record.
- [x] 3.8 Expose cached/live state and last-updated metadata to the existing screens without adding parallel offline domain contexts.
- [x] 3.9 Pause repeated allowlisted read retries while degraded and implement recovery that starts outbox replay before authoritative active-query refetch and cache refresh.
- [x] 3.10 Add provider/integration tests for healthy fresh load, delayed live response, immediate transport failure, deadline fallback, late live replacement, no-cache outage, auth/validation errors, scope switch/sign-out, exact query keys, last-good preservation, and reconnect convergence.

## 4. Safe cold-start service worker

- [x] 4.1 Split service-worker storage into versioned static/offline-fallback, exact route-shell, and same-origin Next runtime-asset caches.
- [x] 4.2 Replace install-time precaching of `/` with a deterministic offline fallback and the existing safe manifest/icon assets.
- [x] 4.3 Extend service-worker registration so a confirmed live scope posts the current canonical route and observed same-origin `/_next/static/` script/style URLs for staging.
- [x] 4.4 Stage the route response and all required runtime assets before atomically publishing a confirmed exact-path shell, preserving the prior shell if staging fails.
- [x] 4.5 Implement network-first document navigation with exact confirmed-shell fallback and the deterministic offline page when no matching shell exists.
- [x] 4.6 Remove generic `/api/` GET caching and destination-wide image caching; allow personalized API data to fall back only through IndexedDB.
- [x] 4.7 Delete the previous monolithic cache versions during activation without deleting the current version's staged shell/runtime caches.
- [x] 4.8 Add service-worker/registration tests for route confirmation, exact-path matching, referenced asset staging, partial-stage rollback, API/image exclusion, old-cache cleanup, and first-ever offline fallback.

## 5. Navigation footer and offline-status modal

- [x] 5.1 Add a compact, always-present connectivity button beside `v{currentVersion}` in the existing `NavbarUserMenu` footer, leaving the avatar and update-available indicator unchanged.
- [x] 5.2 Close the dropdown before opening a sibling `OfflineStatusModal` so the same interaction works from desktop and mobile navigation and focus can return to the invoking button.
- [x] 5.3 Build the HeroUI v3 modal status section with current connectivity, cached/live state, last live success, and a real `Retry connection` action.
- [x] 5.4 Build the cache-inventory section with per-type counts/timestamps, schema and persistence warnings, empty-cache messaging, and a confirmed active-scope clear action.
- [x] 5.5 Move pending/retrying counts, attention entries, retained results, open-result, and acknowledgement controls from the fixed panel into the modal using the existing outbox hooks.
- [x] 5.6 Add the development-only backend-unavailable switch to the modal and require a successful live recovery check when disabling it.
- [x] 5.7 Add cross-tab refresh to the outbox diagnostic/result hooks and remove `WebOutboxStatus` plus its `BaseProviders` mount and obsolete tests/mocks.
- [x] 5.8 Add localized strings for connectivity states, cached/stale/unavailable data, inventory labels, persistence warnings, queue states, retry, clear confirmation, and simulation.
- [x] 5.9 Add component/accessibility tests for footer placement, every status label, menu-to-modal transition, mobile sizing, keyboard focus return, cache summary/actions, production simulator exclusion, outbox sections, and toast-over-modal stacking.

## 6. Playwright browser E2E coverage

- [x] 6.1 Add `@playwright/test` to `apps/web`, create a Chromium `playwright.config.ts`, and add web-owned install/run scripts without adding unrelated root configuration.
- [x] 6.2 Add an isolated E2E service setup for PostgreSQL and Redis with password auth/registration enabled and deterministic cleanup between runs.
- [x] 6.3 Add an authenticated Playwright fixture that signs up through the existing auth surface, seeds recipe/calendar/grocery data through existing authenticated application APIs, and saves storage state without a production auth bypass.
- [x] 6.4 Add a browser test that warms the read cache, delays a fresh load's backend calls, proves existing skeletons render first, then proves live data wins when the backend responds.
- [x] 6.5 Add a browser test that warms the cache, performs a fresh reload with backend requests aborted, and proves matching IndexedDB recipe, detail, calendar, grocery, and store data replaces the skeleton only after failure.
- [x] 6.6 Add a browser offline-mode test that closes and reopens a confirmed route, proves the exact service-worker shell/runtime hydrates, and verifies an unconfirmed route receives the deterministic offline fallback.
- [x] 6.7 Add browser tests for origin/user/household isolation, active-scope cache clearing, last-good retention after failed refresh, and absence of generic personalized API/image Cache Storage entries.
- [x] 6.8 Add browser tests for the footer control and modal inventory, keyboard focus, development simulation, optimistic mutation capture, queued diagnostics, simulator disable/recovery, replay, and final live refetch convergence.
- [x] 6.9 Configure Playwright traces, screenshots, and videos on failure and document the local Chromium/E2E commands.
- [x] 6.10 Add a dedicated CI E2E job that provisions services, installs the matching Chromium binary, starts the web server, runs the critical suite, and uploads failure artifacts.

## 7. Documentation and final validation

- [x] 7.1 Document the live-first startup sequence, allowlisted data and retention, render-only scope security boundary, service-worker cache boundary, status-modal controls, and the lack of closed-PWA mutation replay.
- [x] 7.2 Run the focused read-cache, connectivity, provider, outbox, navbar/modal, service-worker, and integration Vitest suites and fix all failures.
- [x] 7.3 Run the Playwright Chromium suite against the isolated backend and fix all fresh-load, cold-start, isolation, simulation, and recovery failures.
- [x] 7.4 Run web/shared-react typecheck, lint, locale-key validation, and format checks and fix all change-related failures.
- [x] 7.5 Run the production web build and verify the simulator is absent, the service worker is versioned, and online startup remains unchanged.
- [x] 7.6 Run `openspec validate add-web-offline-read-cache-and-status --strict` and reconcile any implementation/spec/task drift before marking the change complete.

## 8. Post-implementation hardening

- [x] 8.1 Prune inactive restored query copies after recovery so the global status reports stale data only while an active screen still depends on it.
- [x] 8.2 Prevent closed/remounted filter panels from repeatedly fetching `config.tags` while preserving the tag cache's five-minute freshness policy.
- [x] 8.3 Move the tests introduced by this change into each workspace's existing test directory structure.
- [x] 8.4 Bump the active application release to `0.20.0-beta` and verify the frozen `0.19.0-beta` documentation snapshot and new current documentation version.
- [x] 8.5 Re-run focused tests, typechecks, formatting, the production build, and strict OpenSpec validation.
