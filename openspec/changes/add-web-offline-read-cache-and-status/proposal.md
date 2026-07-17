## Why

The web app keeps queued mutations across reloads, but its useful read data is still memory-only: a fresh load shows no recipes, calendar, or groceries when the backend cannot be reached. Norish needs a truthful live-first startup that keeps the existing skeleton experience while trying the backend, then falls back to compatible IndexedDB data and makes that offline state understandable from the navigation.

## What Changes

- Persist an allowlisted, bounded set of successful web reads in a dedicated IndexedDB cache: the default recipe dashboard, recently opened recipe details, calendar ranges used by the app, groceries, recurring groceries, recipe-name mappings, and stores. Keep only the minimal last-confirmed user/household render metadata needed to select that scope and mount the offline chrome; it is never authorization.
- On every fresh load, make the normal backend requests first and keep the existing recipe, calendar, grocery, and detail skeleton loaders visible while those requests are pending.
- When that first live attempt fails because the browser is offline or the backend is unreachable, restore a compatible user- and household-scoped snapshot into the exact TanStack Query keys consumed by the current screen. Pause further automatic retries until recovery, then refetch live data and replace the cached view.
- Support cold PWA navigation with a narrowly scoped application-shell/runtime cache while removing the current service worker's generic API GET and all-image caching behavior. Personalized response data remains in IndexedDB, not Cache Storage.
- Add a small, always-present connectivity control to the existing user-menu footer beside the version. Do not move status onto the avatar. Clicking the control opens a responsive HeroUI v3 offline-status modal.
- Show live connectivity, cached-data counts and timestamps, storage/persistence warnings, queued-write diagnostics, retry/clear actions, and a development-only backend-unreachable simulation toggle in the modal.
- Remove the fixed `WebOutboxStatus` diagnostic panel and fold its useful queue/results information into the modal without changing the existing mutation-outbox delivery contract.
- Consolidate web-only connectivity, cache-scope, and startup orchestration so lazy WebSocket state and repeated auth polling are not used as the source of backend reachability.
- Introduce Playwright E2E coverage in `apps/web` for live-first loading, IndexedDB fallback after a fresh reload, service-worker cold start, cache isolation, status-modal behavior, simulation/recovery, and reconnect convergence.

## Capabilities

### New Capabilities

- `web-offline-read-cache`: Live-first persisted web reads, compatible IndexedDB fallback on fresh loads, scoped cache lifecycle, and safe PWA shell behavior.
- `web-offline-status`: Navigation-footer connectivity control, offline/cache modal, development simulation, and integrated queued-write diagnostics.

### Modified Capabilities

<!-- The existing web-mutation-outbox delivery requirements remain unchanged. -->

## Impact

- `apps/web`: provider composition, tRPC HTTP reachability observation, user-menu footer, new offline-status modal/context, cache repository and policy, service worker, translations, unit/integration tests, and a new Playwright configuration and E2E suite.
- `packages/shared-react`: small provider/outbox hook changes only where transport observation or reusable diagnostics already belong; the web read-cache database remains web-owned.
- `apps/web/package.json` and the lockfile: add `@playwright/test`, browser-test scripts, and Chromium installation/documentation.
- CI: add a browser E2E job with an isolated test backend and deterministic authenticated fixture data.
- No server API or database schema is required for the read cache itself. Mobile behavior, arbitrary query persistence, service-worker mutation replay, and closed-PWA background delivery remain out of scope.
