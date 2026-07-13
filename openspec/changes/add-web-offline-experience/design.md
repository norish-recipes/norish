## Context

The completed `add-web-offline-mutation-delivery` change provides a durable, origin- and user-scoped IndexedDB mutation outbox with stable `operationId` values, strict FIFO replay, server receipts, optimistic delivery semantics, and reconnect refetching. It intentionally leaves read-cache persistence, offline cold-start navigation, and service-worker replay out of scope.

The current web `QueryClient` is created in the shared tRPC provider with an in-memory cache. The current service worker precaches shell assets and applies broad GET caching, but it ignores non-GET requests and has no navigation fallback. The Next.js proxy requires a live authenticated server session for application routes, so a cold offline PWA launch needs an explicitly cached shell and a client-side offline identity path.

Norish already has a mobile precedent for persisted query hydration, explicit `offline` versus `backend-unreachable` reachability, and reconnect invalidation. The web design should reuse those behavioral ideas without implicitly expanding the mobile deliverable.

## Goals / Non-Goals

**Goals:**

- Make an installed PWA reopen into a usable offline shell when the server cannot answer the navigation request.
- Persist full details for the canonical first 100 recipes, the current weekly meal plan, and the grocery list.
- Keep cached data scoped to backend origin, user, household context, and cache schema.
- Restore cached data before authenticated query consumers render and revalidate it asynchronously when live access returns.
- Keep offline identity useful for rendering while treating server authentication as authoritative for every replayed write.
- Give connectivity state priority over update-available UI in the avatar status slot.
- Expose queued mutation counts and actionable operation diagnostics.
- Plan and implement a service-worker Background Sync path for the existing outbox while the installed PWA is completely closed where the browser supports it.
- Preserve quick optimistic interaction and never block the application on slow database writes or background replay.

**Non-Goals:**

- Reopen or modify the completed mutation receipt/outbox change.
- Make Background Sync universally available on browsers that do not implement it; unsupported browsers retain next-launch replay.
- Treat a cached session as authorization or allow cached permissions to bypass the server.
- Guarantee periodic background refresh of all recipe data while the app is closed. Periodic Background Sync is an optional future optimization, not the freshness contract.
- Automatically download unbounded recipe videos or all image variants. Media requires an explicit size, eviction, and failure policy.
- Add CRDTs or semantic conflict merging for offline writes.
- Change mobile behavior as an incidental consequence of web cache work.

## Decisions

### D1. Separate the read cache from the mutation outbox

The read cache gets its own IndexedDB database and schema. The existing mutation-delivery database remains independently migratable and durable. This prevents high-volume query-cache writes or cache eviction from interfering with mutation intent.

The read cache stores a persisted TanStack Query client or equivalent selected-query snapshots. Only successful, explicitly allowlisted query keys are persisted:

- the unfiltered recipe dashboard first page with `limit: 100` and the canonical default sort;
- full `recipes.get` records for those 100 IDs;
- the exact current-week `calendar.listItems` range;
- `groceries.list` including recurring groceries and recipe-name mapping.

Alternative considered: persist every TanStack Query entry. Rejected because it would capture arbitrary filters, admin data, transient queries, and potentially sensitive responses without a deliberate offline contract.

### D2. Full recipes are hydrated by a bounded background prefetch

The dashboard list is the discovery source for the first 100 recipe IDs. Full recipe details are fetched through the existing recipe-detail query contract and persisted in bounded batches after the dashboard query succeeds. The foreground UI remains usable while hydration runs.

Recipe detail freshness is tracked independently from list freshness. A recipe missing from the completed detail set remains visible in the dashboard but is marked unavailable offline rather than pretending that the summary is a full recipe.

Images use a separate scoped media cache with an explicit byte budget and eviction policy. Recipe videos and other large media are not implicitly guaranteed offline until a separate media policy is approved.

Alternative considered: persist only dashboard DTOs. Rejected because opening a recipe while offline would still fail to provide ingredients and steps.

### D3. Cache identity is explicit and user-scoped

Every persisted snapshot carries backend origin, user ID, household context or membership revision, cache schema version, data timestamp, and source query identity. A user switch or backend-origin change cannot hydrate another scope's data.

On confirmed sign-out, active in-memory data and the current user's persisted read cache are cleared. If the auth endpoint is unreachable, the last confirmed user may be used for offline rendering exactly as the existing outbox user resolver does, but reconnect must revalidate the live session before replay continues.

Alternative considered: rely on query keys alone. Rejected because query keys do not include the authenticated principal and the current service worker cache can otherwise reuse personalized GET responses across sessions.

### D4. Offline cold start uses a cached app shell, not an auth bypass

The service worker handles navigation requests with a network-first strategy and falls back to a safe cached application shell when the network fails. The shell contains no server-authoritative user data and mounts the existing client providers.

The client restores the last confirmed render identity and persisted query cache after shell boot. It may render cached recipes, meals, groceries, and status information, but all mutations remain queued and all replayed requests still require the current server session.

Alternative considered: bypass the Next.js auth proxy for offline requests. Rejected because the server cannot safely distinguish an offline request from an unauthenticated request, and proxy bypass would weaken the authenticated route boundary.

### D5. Reachability has explicit precedence over update status

The web runtime exposes settled modes `offline`, `backend-unreachable`, and `online`, with an internal `initializing` state during bootstrap. Browser connectivity is only one signal; failed authenticated HTTP delivery and successful recovery also update backend reachability.

The avatar status slot follows this precedence:

```text
initializing       -> no status dot
offline/degraded   -> yellow connectivity dot (highest priority)
online + attention -> warning/queue indicator
online + update    -> existing accent update dot
online + clean     -> no dot
```

The queue count is a separate numeric badge and does not replace the connectivity meaning of the dot. The status surface remains accessible through the avatar and is also available to non-avatar layouts.

Alternative considered: use WebSocket state as the offline signal. Rejected because the WebSocket is lazy and `idle` is a normal state; HTTP queries and mutations can still be healthy when no WebSocket is connected.

### D6. Closed-PWA delivery is a separate service-worker task

When a mutation is durably captured, the window registers one deduplicated Background Sync tag such as `norish-outbox`. The service worker processes the existing outbox records rather than creating a second queue. It must preserve the stored `operationId`, payload codec, origin/user scope, receipt semantics, FIFO ordering, retry metadata, and terminal-state rules.

The worker sends cookie-authenticated requests only after checking that the current server session resolves to the stored user ID. A missing, expired, or different session quarantines the entry and stops the pass. Service-worker and window coordinators use a shared lease or Web Locks-compatible coordination mechanism so a foreground replay and a background replay cannot both own the head item.

The worker notifies controlled clients after state changes. When no client is open, the durable IndexedDB state remains the source of truth and is visible after the next launch.

Background Sync is capability-gated. Where unavailable or rejected, the active app coordinator and next-launch replay remain the fallback. Browser support and worker-lifetime behavior must be validated before enabling this task in production; Background Sync is limited availability and is not a universal PWA guarantee.

Alternative considered: replay only from a hidden-tab interval. Rejected because installed PWAs can be backgrounded or fully closed, and page timers are not a reliable delivery mechanism.

Alternative considered: use periodic background sync for mutation delivery. Rejected because one-off event-driven delivery is the correct semantic fit; periodic sync is better suited to optional freshness work and is not a reliable guarantee.

### D7. Background recipe hydration is bounded and opportunistic

The app schedules full-recipe hydration after the canonical list is available and records progress, failures, and storage pressure. It may continue while the app is open, but offline availability is only claimed for records successfully persisted. A future service-worker or Background Fetch enhancement may continue large media downloads, but it is not part of the correctness contract for this change.

Alternative considered: require the browser to download all 100 full recipes while the PWA is closed. Rejected as a hard guarantee because large background downloads and periodic background execution have limited, browser-dependent support.

### D8. Reconnect ordering remains outbox-first

On foreground reconnect or app startup with a live session, the existing mutation coordinator runs before authoritative active-query refetch. This prevents a stale read snapshot from overwriting queued optimistic intent before replay has had a chance to apply it. Refetch still runs after the replay pass whether the queue drains or stops with remaining work.

## Risks / Trade-offs

- [Full details for 100 recipes and media may exceed browser storage quotas] -> Use bounded batches, byte accounting, explicit media budgets, eviction, and visible partial-cache state.
- [A cold offline navigation can expose stale shell content] -> Mark the runtime as offline, show cache timestamps, and never present cached data as server-confirmed current state.
- [Cached identity can be stale or revoked] -> Use it only for rendering; revalidate before replay and quarantine on mismatch.
- [Service-worker and window replay can race] -> Use a durable lease/lock and retain server receipt deduplication as the final safety boundary.
- [Background Sync is unavailable on some browsers] -> Feature-detect it, record capability state, keep next-launch replay, and do not claim universal closed-app delivery.
- [Full recipe hydration competes with foreground network and storage] -> Schedule small batches, pause on poor connectivity or quota pressure, and prioritize planned recipes.
- [Existing broad service-worker API caching can conflict with explicit user-scoped snapshots] -> Narrow or remove personalized API response caching and make IndexedDB the authoritative offline read cache.

## Migration Plan

1. Add read-cache schema, scope metadata, cache buster, and hydration gates without changing mutation replay.
2. Add the safe offline app shell and cached render identity, then verify cold PWA boot with the backend unavailable.
3. Persist the current canonical recipe, calendar, and grocery snapshots; add bounded full-recipe hydration and media eviction.
4. Add the reachability context and avatar/queue status surface, with connectivity taking priority over update status.
5. Add the closed-PWA Background Sync planning gate as a separately reviewable task: browser matrix, worker transport, auth/session checks, locking, and fallback behavior must be accepted before implementation is enabled.
6. Implement service-worker replay behind a feature flag and validate closed-PWA delivery on supported browsers; retain next-launch replay everywhere.
7. Roll back by disabling background sync first, then read-cache hydration if necessary. Preserve the existing mutation outbox and pending writes during rollback.

## Open Questions

- Should recipe images be hydrated for all 100 full recipes, or should the media budget prioritize the current week's planned recipes?
- Which browser/PWA matrix is required for the “completely closed” guarantee, and which platforms are explicitly best-effort only?
- Should offline rendering be allowed after a long period without session revalidation, or should cached data expire more aggressively?
