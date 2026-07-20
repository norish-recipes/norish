## Context

The web app currently creates an in-memory `QueryClient` inside `createTRPCProviderBundle`. The recipe dashboard, calendar, groceries, stores, user, household, and permissions contexts begin their normal queries as soon as the authenticated layout mounts, and the three offline screens already have suitable skeletons for their first load. This change must preserve that path: a fresh load is live-first, not cache-first.

The existing write-side offline foundation is separate. `packages/shared-react/src/outbox` owns an encrypted IndexedDB mutation outbox, optimistic mutations reach it through a tRPC link after a transport failure, and the replay coordinator refetches active queries after replay. Read-cache eviction, inspection, or clearing must never affect that database or alter operation IDs, receipts, replay ordering, or optimistic UI behavior.

Three current implementation details need cleanup as part of the work:

- `apps/web/public/sw.js` caches all API GET responses and all images under one cache name, but it does not handle document navigations. That is both too broad for personalized data and insufficient for a cold PWA start.
- `useConnectionStatus` primarily describes a lazy WebSocket. `idle` is normal when no subscription is active, so it is not a backend-health signal.
- `WebOutboxStatus` is mounted globally from `BaseProviders` and renders a fixed diagnostic panel. The existing `NavbarUserMenu` already has a small footer containing update/version information and is the intended entry point for a unified status modal.

No browser E2E harness exists in `apps/web`. The repository uses Vitest and React Testing Library for component/integration tests, while the only installed Playwright runtime is an unrelated `playwright-core` dependency used by the server-side browser integration. The web workspace therefore needs its own `@playwright/test` setup.

## Goals / Non-Goals

**Goals:**

- Keep every fresh screen load live-first and reuse the current skeleton loaders while the first backend attempt is pending.
- Fall back to compatible IndexedDB reads promptly after an offline/transport/backend-unavailable outcome or a short reachability deadline.
- Persist only successful records selected by one persistence classifier and seed the exact query keys already consumed by the three offline screens.
- Let a previously opened PWA route load enough shell/runtime code to execute the IndexedDB fallback during a cold outage.
- Provide one web-owned connectivity model based on browser and HTTP outcomes.
- Put a compact, clickable status control beside the existing version footer and show cache/connectivity/outbox details in one accessible HeroUI v3 modal.
- Preserve the completed mutation-outbox contract and quick optimistic interaction.
- Add real Chromium E2E tests for fresh reload, service-worker cold start, IndexedDB isolation, simulator behavior, and reconnect convergence.

**Non-Goals:**

- Do not hydrate cached reads before trying the backend on a fresh load.
- Do not persist the whole TanStack Query cache, arbitrary filtered searches, admin data, auth responses, or public/share-route queries.
- Do not persist recipe-detail reads or crawl/prefetch them for offline storage.
- Do not provide offline recipe/gallery media guarantees. Generic content-image caching is removed from the service worker.
- Do not use cached user, household, or permission data to authorize a server request.
- Do not change mutation receipt semantics, add a second mutation queue, or implement service-worker/background replay while the PWA is closed.
- Do not add mobile behavior, a server database table, or a new backend endpoint.
- Do not make lazy WebSocket state the connectivity source.

## Decisions

### D1. Keep the read cache web-owned and physically separate from the outbox

Add a native IndexedDB repository under `apps/web/lib/offline-read-cache` using a new `norish-web-read-cache` database. Its stores will separate scope metadata from data records:

- `scopes`: origin, confirmed user, confirmed household, schema version, minimal render-only user/household metadata, last live success, and last persistence warning;
- `records`: scope key, record kind, exact serialized TanStack query key, payload, server/query timestamp, persistence timestamp, last access, and summary counts.

The record kinds are `recipe-dashboard`, `calendar-range`, `groceries`, and `stores`. Stores are supporting data for the grocery screen, not a fourth offline surface. Each kind has at most one record in a compatible scope. A transaction replaces one complete record at a time, so an aborted write cannot erase the previous value. The summary API calculates the counts and timestamps needed by the modal without exposing raw payloads to UI components.

The unified scope key remains backend origin, confirmed user, confirmed household (or personal-user scope), and schema version. This is a conservative isolation and compatibility partition for all three surfaces. Dashboard visibility is determined by the server's recipe view policy (`everyone`, `household`, or `owner`), so the cached dashboard is only the last successful server-authorized projection for that viewer.

Persistence eligibility is determined by the offline surfaces and their existing query contracts, independent of the scope partition. Dashboard, calendar, groceries, and the grocery screen's supporting store read are eligible because those interfaces must remain useful offline; the scope key only prevents an incompatible viewer, backend, or schema from receiving the snapshot.

The cache will use small native IndexedDB helpers instead of a general TanStack persister. A generic dehydrated QueryClient blob makes classification, per-record retention, atomic last-good preservation, exact inventory, and targeted clearing harder. It also risks a later failed/partial query-client save replacing an otherwise useful snapshot.

Alternative considered: add read stores to `norish-web-mutation-delivery`. Rejected because cache eviction, quota pressure, clearing, and schema rotation must not share failure modes with durable writes.

Alternative considered: add `@tanstack/query-persist-client-core` and persist all successful queries. Rejected because query keys do not include principal scope, and broad persistence would capture transient or sensitive responses outside this capability.

### D2. Use a single live-first startup state machine

Add a web `OfflineWebProvider` inside the existing tRPC/QueryClient provider and outside the app's user/household contexts. It owns these startup phases:

```text
probing-live -> live
             -> loading-fallback -> cached
                                -> unavailable
cached -> recovering -> live
```

At mount, the provider starts a real session/backend attempt and lets the normal screen queries run immediately. It does not prehydrate payloads. The existing recipe-dashboard, calendar, and grocery loading states therefore continue to render their current skeletons.

IndexedDB scope metadata may be opened in parallel to reduce fallback latency, but payloads are withheld. The first qualifying HTTP/tRPC reachability failure transitions to `loading-fallback` immediately. A 2.5-second startup deadline also permits fallback when requests hang; it does not abort a still-useful live request. If that late request succeeds, its result wins and moves the app to `live`.

Confirmed authentication, authorization, and validation responses do not trigger fallback. A confirmed anonymous session clears the active render scope and follows the login path. If no compatible record exists, the relevant skeleton resolves to an explicit unavailable-offline state rather than a false empty list.

Alternative considered: restore IndexedDB before mounting query consumers. Rejected because the requested behavior is live-first, and cache-first hydration would flash stale content even when the backend is healthy.

Alternative considered: wait for all initial queries and their default retries. Rejected because a cold outage would keep skeletons up for too long. The single reachability deadline bounds the wait without adding a blocking full-screen restore gate.

### D3. Persist and restore through one explicit classifier

The provider will build a persistence registry from the real tRPC query helpers exposed by `useTRPC`, rather than comparing hand-written string keys. One classifier owns candidate matching for both scope cleanup and successful-record description. It will subscribe to QueryCache success updates and map only these identities:

- the shared default recipe dashboard query with limit 100 and current default filters;
- the latest successful `calendar.listItems` range used by the calendar screen;
- `groceries.list`;
- `stores.list`, solely as supporting data for the grocery screen.

On a successful classified network query, a throttled repository write stores the exact query key and complete data. Manual QueryClient writes from fallback restoration, optimistic mutation handlers, and subscription reconciliation are projections rather than confirmed server reads, so they never advance the persisted snapshot. Errors, pending state, empty partial objects, and aborted transactions do not advance the record. On fallback, `queryClient.setQueryData` seeds those same stored keys. Screen availability is derived from whether the exact query has resolved data, not from TanStack Query's status alone, because an in-flight live request may fail after fallback installation while retaining the restored payload under an `error` status. If an inactive restored query is later garbage-collected from memory, its compatible persisted identity remains available and is rehydrated when that exact consumer mounts again during the same outage. Query-cache notifications that can originate during consumer render are deferred before updating provider state. The existing dashboard, calendar, grocery, and store consumers then stop showing their skeletons naturally because their normal query identities receive data.

While degraded, the calendar keeps the last persisted range stable instead of automatically expanding its viewport into a different, uncached query identity. User navigation can still select another range and truthfully receive an unavailable-offline result. On an application restart, durable outbox entries remain available for replay but their in-memory optimistic QueryCache projection is not reconstructed; the read cache continues to represent the last successful server-authorized snapshot. Reconstructing pending optimistic state from outbox entries is explicitly outside this change.

The scope record also keeps the minimal last-confirmed user and household values needed to mount the offline chrome and select records. `UserProvider` receives a web session hook that prefers the live Better Auth session and uses this render-only value only after live reachability failure. The compatible household query key is seeded from the same metadata. Permissions remain conservative when they were not confirmed; cached identity is never passed as proof of server authorization.

Alternative considered: create parallel offline recipe/calendar/grocery contexts. Rejected because duplicate data paths would drift from the current query keys, subscriptions, skeletons, and optimistic-update logic.

### D4. Observe reachability through HTTP and reconnect subscriptions in parallel with recovery

Add an injectable fetch adapter to the shared tRPC link factory. The web adapter wraps native `fetch`, reports successful HTTP responses and reachability failures to a small web runtime store, and implements the development simulation at the deepest transport boundary. The outbox link remains upstream of transport, so a simulated mutation error propagates through the same `isBackendUnreachableError` path and is durably captured exactly like a real failure.

HTTP remains the authority for backend reachability, but an active WebSocket SHALL NOT continue delivering subscription updates after that authority enters `offline` or `backend-unreachable`. The web tRPC integration closes the current WebSocket transport when connectivity becomes degraded and defers its next URL resolution only until a browser-triggered or explicit recovery attempt begins. Pending subscription consumers then reconnect through the existing tRPC WebSocket client in parallel with the HTTP check and any later mutation replay. Socket state never declares the runtime online; if the HTTP recovery check fails, the transport is suspended again.

The connectivity context exposes `checking`, `online`, `offline`, and `backend-unreachable`:

- browser `offline` events set the user-facing state but do not suppress the one initial live attempt;
- fetch rejection and classified 502/503/504 outcomes set `offline` or `backend-unreachable` according to `navigator.onLine`;
- HTTP success and an explicit session recovery check can confirm `online`;
- WebSocket callbacks remain available for subscription behavior but do not control this state; degraded HTTP state suspends their transport until a recovery attempt starts and suspends it again when that attempt fails.

The development toggle is persisted in local storage only when `NODE_ENV` is development. Production code ignores stored override values. Turning the toggle off starts a single-flight Better Auth session check and permits WebSocket reconnection immediately. Online state, outbox replay, and read revalidation still require that HTTP check to succeed.

Alternative considered: implement simulation as a tRPC link before the outbox. Rejected because an error produced upstream without calling the next link would bypass outbox capture.

Alternative considered: use `/api/v1/health` for recovery. Rejected because that endpoint includes parser-service health; parser degradation should not falsely mark all core recipe/grocery reads unreachable. The existing session request is lightweight and also confirms the live principal needed for replay.

### D5. Pause retry churn without globally disabling mutations

The read-cache integration will add connectivity-aware query retry and focus-refetch policies to the web QueryClient and cancel affected in-flight retries when fallback is installed. While state is offline/backend-unreachable, persisted reads do not continuously retry; an explicit or browser-triggered recovery check is the gate to refetch.

The implementation will not globally set TanStack's `onlineManager` to offline unless mutations are separately guaranteed to use a transport-reaching network mode. Globally pausing the QueryClient can prevent an offline mutation from reaching the existing outbox link, which would break durable optimistic capture. Query retry control therefore remains read-specific, and mutation behavior is covered by integration and Playwright tests.

On recovery, WebSocket subscriptions reconnect independently while a typed web recovery coordinator signals the existing replay coordinator after HTTP success. The outbox coordinator invalidates active authoritative reads only after its sequential replay pass settles, then signals the offline lifecycle through the same typed coordinator so cached-query ownership can be pruned and the phase can converge. This keeps the ordering explicit without global DOM events or a second external startup state store. Subscription updates received during replay are provisional; the final refetch repairs missed events and any transient interleaving. The five-second auth-readiness polling loop can then be removed in favor of startup, outbox-change, browser-online, and explicit-recovery triggers. Capture may use the last confirmed user ID to label an offline entry; replay resolves a fresh live session and never uses render-only identity.

When the confirmed viewer changes, inactive queries from the previous viewer are removed and active queries are reset so their observers refetch for the new viewer. Removing an active query outright would leave a mounted observer able to retain or reactivate stale principal data.

Alternative considered: use `onlineManager.setOnline(false)` for the whole app. Rejected because it can pause mutations before the outbox observes a transport failure.

### D6. Replace broad service-worker caching with confirmed route shells

Split service-worker caches by responsibility and version:

- a small install-time static cache for manifest/icons/offline fallback;
- a route-shell cache limited to `/`, `/calendar`, and `/groceries`;
- a runtime-asset cache limited to same-origin `/_next/static/` scripts and styles referenced by a confirmed shell.

Document navigation is network-first. The server documents for supported offline routes are user-neutral boot documents: they may contain route structure and localization, but no authenticated user, household, recipe, calendar, or grocery result. Once a live compatible scope is confirmed, the client registration component sends the current canonical offline route to the service worker. The worker fetches that document, derives its required same-origin Next scripts and styles from the HTML, fetches every required asset, and publishes the shell last. The cached HTML is the sole index of its required runtime assets, so no synthetic per-route manifest, temporary staging cache, or browser-side asset scan is required. An offline navigation uses only an exact supported route match whose referenced assets are present; otherwise it returns the deterministic offline fallback.

The service worker is a boot-only adapter. It never stores personalized API responses, writes IndexedDB records, captures mutations, replays the outbox, or performs background sync.

The new worker removes the `/api/` network-first cache branch and the `request.destination === "image"` cache-first branch. API requests go directly to network/tRPC and personalized fallback comes only from the scoped IndexedDB repository. Content images remain online-only under this change. Activation deletes the previous monolithic cache version so old personalized GET/image entries are not retained.

Alternative considered: continue precaching `/`. Rejected because installation may occur before authentication and can cache a login/redirect document instead of an authenticated application shell.

Alternative considered: serve the root shell for every offline route. Rejected because Next App Router documents and route assets are not safely interchangeable across arbitrary paths.

### D7. Make the existing user-menu footer the single entry point

`NavbarUserMenu` keeps its current avatar and update-available indicator. Its bottom metadata row becomes two compact items: a connectivity button and `v{currentVersion}`. Activating connectivity closes the dropdown and opens `OfflineStatusModal`, rendered as a sibling so closing the menu does not unmount the dialog. The same component is already used by desktop and mobile navigation, so one integration covers both.

The HeroUI v3 modal is composed from context-backed sections:

- current status, cached/live label, last live success, and retry action;
- cache inventory by record type, timestamps, schema/persistence warning, and confirmed clear action;
- active/retrying outbox counts, attention entries, retained results, and acknowledgement;
- a development-only `Simulate backend unavailable` switch.

The modal reads existing `useWebOutboxDiagnostics` and `useWebOutboxResults` hooks. Those hooks gain cross-tab refresh through `BroadcastChannel` with the current DOM event as a same-tab fallback. The fixed `WebOutboxStatus` component and its `BaseProviders` mount are deleted. Clearing cache calls only the read-cache repository and never the outbox repository.

Alternative considered: put a status badge on the avatar. Rejected because the requested reference is the small version footer, and the avatar already owns update availability.

### D8. Add web-owned Playwright E2E validation

Add `@playwright/test`, `playwright.config.ts`, and `e2e/` under `apps/web`, plus workspace scripts for installing Chromium and running browser tests. Start with one Chromium project because service-worker/IndexedDB correctness is the objective; unit and integration coverage remains browser-independent in Vitest.

The E2E environment uses an isolated PostgreSQL/Redis backend with password authentication and registration enabled. A fixture signs up a unique user through the existing auth surface, seeds deterministic recipe/calendar/grocery data through authenticated application APIs, and saves authenticated storage state. No production test-only authentication bypass or data endpoint is added.

Browser scenarios will:

1. open the real routes online and wait for successful read-cache commits;
2. reload with tRPC/session requests delayed to prove skeletons appear and cached payloads do not render early;
3. abort backend requests or use Chromium offline mode, then prove the dashboard, calendar, grocery, and supporting store data replace their skeletons after failure;
4. close/reopen a page under offline mode to prove the confirmed service-worker route shell hydrates on a cold start;
5. verify a different browser user/scope cannot see the first user's records;
6. open the footer control and validate modal inventory, clear confirmation, accessibility, development simulation, queued mutation capture, and recovery;
7. restore connectivity, prove WebSocket reconnection begins independently, and prove replay settles before final live refetch convergence.

CI gets a dedicated E2E job that installs the matching Chromium binary, provisions the isolated services, starts the web server, preserves traces/screenshots on failure, and runs independently from the existing Vitest job. A production-mode component/build assertion verifies that the development simulator is absent even though simulator behavior is exercised in the development E2E server.

Alternative considered: extend the existing `*.e2e.test.tsx` Vitest file only. Rejected because fake IndexedDB and jsdom cannot prove service-worker document navigation, browser offline mode, fresh process behavior, focus management, or real Cache Storage.

## Risks / Trade-offs

- [A 2.5-second deadline may show cached data shortly before a slow live response arrives] → Keep the live request running, let a successful live result win, and show a cached/stale label during the brief fallback window.
- [Cached render identity or household membership is stale] → Scope records to the last confirmed tuple, treat it as render-only, use conservative permissions, and replace/clear it immediately after a contradictory live session.
- [Exact dynamic calendar ranges reduce offline coverage] → Persist the latest real range instead of inventing projections; the modal makes the available range/count truthful, and broader policy can be added later from evidence.
- [Native IndexedDB code adds repository logic] → Keep it web-local, use small transaction helpers, test upgrades/aborts/quota behavior with fake IndexedDB, and keep the schema narrower than a general query persister.
- [Service-worker shell caching can retain stale runtime assets or personalized server-rendered content] → Keep supported route documents user-neutral, assert known user/domain values are absent before relying on the shell, version cache names, fetch every required asset before publishing the HTML shell, validate the assets referenced by that shell before serving it, use network-first navigation, and delete old cache versions on activation.
- [A first-ever offline launch has no shell or data] → Return an explicit offline fallback; the feature promises cold starts only after a successful online route/cache fill.
- [Disabling generic image caching means offline cards can lack images] → Treat text/data correctness as the first milestone and avoid cross-user media leakage; explicit scoped media caching can be a later change.
- [Connectivity signals can flap across simultaneous requests] → Use a single runtime store, single-flight recovery checks, monotonically tracked last success/failure times, and do not let WebSocket idle state override HTTP success.
- [Subscription updates can interleave with replayed mutations] → Treat those updates as provisional and run one authoritative active-query refetch after the sequential replay pass settles.
- [E2E infrastructure increases CI time and setup complexity] → Limit the first suite to Chromium, reuse existing auth/application APIs, run it as a separate job, and keep fast deterministic repository/component coverage in Vitest.

## Migration Plan

1. Add the read-cache repository, query registry, connectivity runtime, and tests without enabling service-worker fallback.
2. Integrate the live-first provider and exact-key persistence/fallback behind the new read-cache schema version; confirm online behavior remains unchanged.
3. Replace the status panel with the footer control/modal and wire cross-tab inventory/outbox events.
4. Ship the versioned service worker that deletes the old monolithic cache and begins confirming route shells after live scope resolution.
5. Add Playwright, the isolated fixture environment, and CI job; require the critical live-first, cold-start, scope-isolation, and reconnect tests before completing the change.

Rollback consists of restoring the previous provider/service-worker code while leaving `norish-web-read-cache` unused. The new database is independent from the outbox and server data, so it can be safely ignored or deleted without migration. Rolling back the worker must use a new cache version so clients do not continue using route shells written by the newer worker.

## Open Questions

None required before implementation. The 2.5-second fallback deadline can be tuned later from E2E timing and real storage telemetry without changing the compatibility or live-first contracts.
