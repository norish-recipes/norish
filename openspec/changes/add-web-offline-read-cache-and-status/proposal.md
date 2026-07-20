## Why

The web app keeps queued mutations across reloads, but its useful read data is still memory-only: a fresh load shows no recipes, calendar, or groceries when the backend cannot be reached. Norish needs a truthful live-first startup that keeps the existing skeleton experience while trying the backend, then falls back to compatible IndexedDB data and makes that offline state understandable from the navigation.

## What Changes

- Persist a classified, bounded set of successful web reads in a dedicated IndexedDB cache for exactly three offline surfaces: the default recipe dashboard, the latest calendar range, and groceries. The grocery surface also persists the recurring-grocery, recipe-name, and store data it needs to render. Keep only the minimal last-confirmed user/household render metadata needed to select a compatible snapshot and mount the offline chrome; it is never authorization.
- Select persisted reads by the application surfaces that need offline data, independent of whether a result is personal or household-related. The persisted dashboard is the last successful server-authorized result for that viewer; the shared user/household cache partition is only a conservative isolation and compatibility key.
- On every fresh load, make the normal backend requests first and keep the existing recipe, calendar, grocery, and detail skeleton loaders visible while those requests are pending.
- When that first live attempt fails because the browser is offline or the backend is unreachable, restore a compatible viewer snapshot into the exact TanStack Query keys consumed by the current screen. Pause further automatic retries until recovery, then refetch live data and replace the cached view.
- Support cold PWA navigation for `/`, `/calendar`, and `/groceries` with a narrowly scoped, user-neutral application-shell/runtime cache while removing the current service worker's generic API GET and all-image caching behavior. The worker only boots the client; personalized response data remains in IndexedDB and mutation replay remains in the foreground app.
- Add a small, always-present connectivity control to the existing user-menu footer beside the version. Do not move status onto the avatar. Clicking the control opens a responsive HeroUI v3 offline-status modal.
- Show live connectivity, cached-data counts and timestamps, storage/persistence warnings, queued-write diagnostics, retry/clear actions, and a development-only backend-unreachable simulation toggle in the modal.
- Remove the fixed `WebOutboxStatus` diagnostic panel and fold its useful queue/results information into the modal without changing the existing mutation-outbox delivery contract.
- Keep every mutation eligible for durable outbox capture after an unreachable transport result. The outbox survives an application restart, while its in-memory optimistic QueryCache projection is intentionally not reconstructed in this change.
- Consolidate web-only connectivity, cache-scope, and startup orchestration so lazy WebSocket state and repeated auth polling are not used as the source of backend reachability.
- Reconnect WebSocket subscriptions as soon as a recovery attempt begins, in parallel with the HTTP check and any later outbox replay. Keep one authoritative active-query refetch after sequential replay so missed or interleaved subscription updates still converge.
- Keep implementation detail in OpenSpec and tests rather than publishing a public technical-documentation section.
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
- `apps/web/package.json` and the lockfile: add `@playwright/test`, browser-test scripts, and Chromium installation.
- `apps/docs`: remove the public technical-documentation category and its implementation-detail pages.
- CI: add a browser E2E job with an isolated test backend and deterministic authenticated fixture data.
- No server API or database schema is required for the read cache itself. Mobile behavior, arbitrary query persistence, service-worker mutation replay, and closed-PWA background delivery remain out of scope.
