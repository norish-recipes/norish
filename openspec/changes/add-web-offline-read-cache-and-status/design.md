## Context

Norish's web mutation-delivery foundation already provides an encrypted, origin- and user-scoped IndexedDB outbox with stable operation IDs, FIFO replay, authentication rejection, and reconnect refetching. That foundation is the write-side contract and must remain independent from read-cache eviction or hydration.

The web `QueryClient` is currently in memory. The service worker precaches static assets, applies broad GET strategies, ignores non-GET requests, and has no safe offline navigation fallback. The authenticated Next.js proxy expects a live server session for application routes. A cold offline PWA launch therefore needs a cached shell/bootstrap path and an explicitly scoped client read cache rather than an auth-proxy bypass.

The existing `apps/web/components/web-outbox-status.tsx` is mounted from the provider tree, but returns `null` when there is no queue activity and otherwise renders a raw fixed diagnostic panel. It is not a HeroUI v3 surface and is not discoverable from the avatar. The existing navbar user menu already provides the correct integration point for a compact connectivity indicator and a queue view.

## Goals / Non-Goals

**Goals:**

- Persist selected successful web read data across reloads and cold offline PWA starts.
- Scope every persisted read record to backend origin, authenticated user, household context or revision, and cache schema version.
- Persist the canonical first 100 recipe dashboard summaries, up to 50 complete recipe details, the current local calendar week, and the grocery snapshot.
- Cache only the thumbnail image used by each cached dashboard recipe. If that thumbnail is the same resource as the recipe's main hero image, cache the single shared resource; do not cache a separate hero, gallery, avatar, video, or other recipe image.
- Prioritize current-week planned recipes during the bounded full-recipe hydration pass.
- Restore usable cached data before authenticated query consumers render, then revalidate asynchronously when the backend is reachable.
- Provide a safe offline app shell/fallback without weakening the server-side authentication proxy.
- Make the service worker cache boundary explicit and prevent generic personalized API GET caching.
- Replace the raw outbox panel with HeroUI v3 avatar status, queue count, and accessible queue details.
- Make offline/backend-unreachable state take precedence over update-available status.
- Preserve quick optimistic interaction and the existing outbox-first reconnect convergence behavior.

**Non-Goals:**

- Do not change the completed web mutation-outbox requirements, receipt semantics, operation IDs, FIFO replay, or retention behavior.
- Do not implement service-worker Background Sync or any closed-PWA mutation replay. The technical documentation will record this as deferred and unsupported by the current contract; queued mutations replay when the app is open and online or on the next launch.
- Do not modify mobile offline caching, mobile authentication, or the mobile outbox.
- Do not persist arbitrary TanStack Query entries, admin data, transient queries, or every active filter/search result.
- Do not guarantee all recipe media offline. Only cached dashboard thumbnail images are in scope; a distinct full-size hero, gallery, avatar, video, or other image is out of scope.
- Do not treat cached identity, permissions, or query data as authorization for a server mutation.
- Do not add a server API, database table, CRDT, or semantic conflict-merging system for this change.

## Decisions

### D1. Use a separate IndexedDB read-cache database

The read cache will use its own IndexedDB database and schema, separate from `norish-web-mutation-delivery`. This keeps query persistence, hydration, and eviction from interfering with durable mutation intent or its encryption key.

The implementation may reuse `@tanstack/query-persist-client-core` and the mobile persistence precedent, but the web persister must use a web-appropriate IndexedDB adapter and explicit dehydration rules. Only successful, allowlisted query data may be persisted.

Alternative considered: persist the existing mutation database alongside query snapshots. Rejected because cache eviction and high-volume query writes should never be able to corrupt or delay the write outbox.

Alternative considered: persist every QueryClient entry. Rejected because query keys do not encode principal or household scope and broad persistence would capture arbitrary filters, admin data, and transient responses.

### D2. Make cache identity explicit

Each persisted snapshot will carry backend origin, user ID, household context or membership revision, cache schema version, query identity, data timestamp, and persistence outcome. A user switch, backend-origin switch, household membership change, or cache-schema change must prevent hydration of incompatible records.

The existing cached user ID fallback may help the window select the outbox scope while offline, but it is not an authorization source. Server mutations remain protected by the live authenticated request context. Confirmed sign-out or user switch must clear or isolate the previous user's read cache.

Alternative considered: rely on TanStack Query keys alone. Rejected because current query keys do not include authenticated principal or household membership.

### D3. Persist a deliberately bounded canonical dataset

The canonical read set is:

- the unfiltered default recipe list's first 100 dashboard summaries;
- the dashboard thumbnail image for each cached recipe summary, with the shared thumbnail/hero URL cached only once;
- up to 50 full `recipes.get` records;
- the current local Monday-to-Sunday calendar range;
- `groceries.list`, including recurring groceries and its recipe mapping.

Full recipe hydration will run in small bounded batches after the canonical list and weekly plan are available. Planned recipe IDs receive priority, followed by the remaining canonical list in default date-descending order. A detail is considered offline-ready only after its complete record is persisted successfully. Partial hydration remains visible as partial availability rather than being reported as complete.

Alternative considered: cache only the recipe dashboard DTOs. Rejected because offline cooking requires ingredients and steps, not merely recipe cards.

Alternative considered: hydrate all recipes without a limit. Rejected because browser quota and foreground bandwidth are finite and the product needs predictable offline behavior.

### D4. Restore selected data through a safe offline bootstrap

The service worker will use a network-first navigation strategy with a deterministic cached shell/fallback. The shell contains no server-authoritative authorization decision. The client restores the last compatible render identity and selected read snapshots, marks them as cached/stale, and mounts the authenticated data tree without requiring a successful navigation response.

The server-side auth proxy remains authoritative whenever a request reaches the server. Cached identity is render-only. Mutations remain handled by the existing web outbox and still require a live server session when replayed.

Alternative considered: bypass the auth proxy for offline routes. Rejected because the server cannot safely distinguish an offline request from an unauthenticated request and the bypass would weaken the authenticated route boundary.

### D5. Narrow service-worker caching to explicit safe resources

The generic `/api/` GET network-first cache will be removed or narrowed to an explicit allowlist of non-personalized resources. Personalized recipes, groceries, calendar data, auth/session responses, and other user-scoped data will not use the generic Cache API path. The IndexedDB read cache is the authoritative source for personalized offline data.

Image caching will be treated as an explicit policy rather than an accidental consequence of `request.destination === "image"`. Only thumbnail URLs associated with the cached dashboard recipe summaries may be added to the offline media cache. If a thumbnail URL equals the recipe's main hero URL, the one cached response naturally covers both uses; a distinct hero URL is not fetched or cached for offline use. Gallery images, alternate recipe images, avatars, videos, and other image resources remain out of scope.

Alternative considered: keep the generic API cache because most tRPC reads use POST. Rejected because future and auxiliary GET endpoints can still leak stale personalized responses across user scopes, and the existing cache key has no principal dimension.

### D6. Derive connectivity separately from lazy WebSocket state

The status model will distinguish `initializing`, `offline`, `backend-unreachable`, and `online`. It will combine browser connectivity signals with observed HTTP delivery failures and successful recovery. Lazy WebSocket `idle`/`connecting` state will not be treated as proof that the backend is offline.

The avatar status priority will be:

```text
initializing                    -> no indicator
offline/backend-unreachable    -> yellow dot
online + queue attention        -> warning status
online + active queued writes  -> queue count badge
online + update available       -> existing accent update dot
online + clean                  -> no indicator
```

The connectivity indicator wins over update status. Color will not be the only signal; the queue view and accessible labels will expose the textual state.

### D7. Replace the raw diagnostic panel with HeroUI v3 composition

The outbox data hooks and repository diagnostics remain reusable, but the web surface will be split into an avatar indicator and an on-demand queue view. The avatar will use HeroUI v3 `Badge.Anchor` around the existing `UserAvatar`, using an empty warning badge for offline status and a content badge for active queue count. The user menu will expose an `Offline queue` item, and the detail view will use HeroUI v3 overlay/card/button composition with `onPress` handlers.

The active count is `pending + retrying`. Quarantined, terminal, and expired entries are reported separately as items requiring attention. Retained completed results remain accessible but do not inflate the active queue count.

Alternative considered: keep a fixed bottom-right panel. Rejected because it is invisible when clean, disconnected from the user's existing status surface, difficult to discover, and inconsistent with the HeroUI v3 UI system.

### D8. Preserve existing outbox-first convergence

On startup or reconnect, the existing mutation replay pass remains responsible for queued writes. Authoritative refetch continues after the replay pass settles so persisted optimistic state is not immediately overwritten by an older read snapshot. Read-cache persistence must not introduce a second mutation queue or change the existing server receipt contract.

### D9. Defer closed-PWA mutation replay

No `sync` event, service-worker outbox coordinator, or background mutation transport will be added. A queued write is durable across reloads and will replay while the app is running and online or on the next app launch. Technical documentation will record that fully closed-PWA replay is deliberately deferred because browser background execution is not a dependable cross-platform contract.

## Risks / Trade-offs

- [50 full recipe records plus dashboard thumbnails can exceed browser quota] → Persist JSON details separately from media, hydrate in small batches, account for storage outcomes, and mark only successfully persisted records offline-ready.
- [Cached data is stale] → Store timestamps and scope metadata, show last-synced/stale state, and revalidate asynchronously whenever connectivity returns.
- [A user changes while cached data exists] → Scope by origin/user/household revision, clear or isolate prior data on confirmed identity changes, and never use cached identity for authorization.
- [A cold offline navigation has no valid shell] → Return a deterministic offline fallback explaining that the app must first be opened online; do not bypass the auth proxy.
- [The service worker serves stale private resources] → Remove generic personalized API caching and allow only the explicitly scoped dashboard-thumbnail policy for recipe media.
- [Hydration competes with foreground activity] → Use bounded concurrency, yield between batches, prioritize planned recipes, and pause on poor reachability or quota pressure.
- [Multiple tabs disagree about queue count] → Broadcast outbox changes across tabs or refresh diagnostics through a shared event mechanism in addition to the existing same-window event.
- [A status dot is ambiguous] → Pair the indicator with accessible labels and an explicit queue/status row in the user menu.
- [Closed-PWA replay remains unavailable] → Make next-launch replay the documented fallback and avoid advertising background delivery.

## Migration Plan

1. Add the separate read-cache schema, persister, scope metadata, cache buster, and selected-query dehydration rules without changing the mutation outbox database.
2. Add cache restore/bootstrap state and the safe offline navigation fallback; verify authenticated route behavior remains unchanged online.
3. Persist the canonical recipe summaries, bounded full-recipe details, current local week, and grocery snapshot; add freshness, partial hydration, and quota diagnostics.
4. Remove or narrow generic service-worker API caching and establish explicit static/shell/dashboard-thumbnail cache rules.
5. Replace the raw `WebOutboxStatus` surface with the HeroUI v3 avatar indicator and queue view; add translations, accessibility labels, and cross-tab refresh behavior.
6. Validate startup ordering: replay matching queued writes first, then refetch authoritative active queries and asynchronously refresh the read cache.
7. Roll back by disabling read-cache hydration and restoring the previous static-cache behavior if necessary. Preserve the existing mutation outbox and its pending entries during rollback.

## Open Questions

- What freshness/retention windows should be used for recipes, the current week, and groceries before cached data is discarded rather than merely marked stale?
- Should planned recipes consume slots within the fixed 50-detail budget, or should a small planned-recipe overflow be allowed?
- Should the queue view support explicit discard actions for terminal/quarantined entries in this change, or remain read-only until a later diagnostics refinement?
