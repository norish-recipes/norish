## Context

The Norish mobile app (Expo SDK 55, React Native 0.83) currently behaves as if all reachability is binary: if requests work, the app feels online; if they fail, the user sees loading or error states. Authentication tokens are already persisted securely via `expo-secure-store` (through the Better Auth Expo plugin), and a general-purpose MMKV storage instance exists at `lib/storage/mmkv.ts`. The app has `expo-network` installed but unused. TanStack Query powers all data fetching through a shared `createTRPCProviderBundle` in `packages/shared-react`, which instantiates its own `QueryClient` internally.

The shared `ConnectionContext` tracks WebSocket status (`connected | disconnected | idle | connecting`), but WebSocket state is only one signal. For mobile offline support, we need to distinguish three layers explicitly:

1. **`deviceOnline`** — does the phone appear to have internet connectivity?
2. **`backendReachable`** — can the configured Norish backend answer `GET /api/health` right now?
3. **`appOnline`** — can the app safely perform live server work right now? (`deviceOnline && backendReachable`)

We also need to distinguish **"not ready to classify yet"** from those settled states during startup. Cache restore and the first backend probe can both be in flight while the app is booting. If we collapse that bootstrap window into `offline` or `backend-unreachable`, we risk showing the wrong banner, firing the wrong reconnect logic, or rendering spinner-first UX before cached data is ready.

WebSocket state remains useful for subscriptions and live-sync diagnostics, but it is no longer the source of truth for online/offline behavior.

## Goals / Non-Goals

**Goals:**

1. **Three-layer reachability model** — Provide a single `NetworkProvider` + `useNetworkStatus()` hook that exposes `deviceOnline`, `backendReachable`, `appOnline`, and the current reachability mode for UI decisions.
2. **Hidden bootstrap runtime state** — Track an internal startup/runtime phase so cache restore and the initial reachability check are not misrepresented as a user-visible fourth reachability mode.
3. **Backend-aware TanStack Query online state** — Wire the mobile reachability model into TanStack Query's `onlineManager` using `appOnline`, so queries pause not only when the device is offline, but also when the configured backend is unreachable.
4. **Persistent query cache with startup hydration gate** — Back the mobile `QueryClient` with an MMKV persister and restore the cache before authenticated query consumers render, so cached data is available immediately on cold start.
5. **Session re-validation on real reconnect** — Re-check the Better Auth session only when the app transitions from not-ready to ready (`appOnline: false -> true`).
6. **Cache invalidation on real reconnect** — Invalidate stale queries only when the backend is reachable again, not merely when the phone regains a network interface.
7. **Cache isolation and cleanup** — Clear persisted query data on sign-out and backend URL change so cached household/user data cannot leak across identities or environments.
8. **Reachability-aware banner** — Show a shell-level banner that differentiates between device-offline and server-unreachable states while continuing to render cached content when available.

**Non-Goals:**

- Offline writes / mutation queue (no persisted or deferred create/update/delete replay).
- Full offline-first architecture (e.g., local SQLite mirror).
- Offline image caching (handled separately by `expo-image` cache).
- Backend-side changes — everything here is mobile-client-only.
- Offline search index — read-only cached data is sufficient for now.

## Decisions

### 1. Reachability model: device, backend, and app-online are separate signals

**Decision**: `NetworkProvider` will expose a richer reachability model rather than a single boolean. At minimum it will publish:

- `deviceOnline: boolean`
- `backendReachable: boolean`
- `appOnline: boolean` (`deviceOnline && backendReachable`)
- `mode: 'offline' | 'backend-unreachable' | 'online'`

Internally, it will also track a hidden runtime state such as `runtimeState: 'initializing' | 'ready'`. `initializing` covers startup cache restore and the first reachability determination. It is not a fourth user-visible `mode`; it exists so the shell can suppress premature offline/server-unreachable UI and keep authenticated query consumers gated until the system has enough information to classify itself.

**Why**: These states answer different questions:

- `deviceOnline` tells us whether the phone has connectivity.
- `backendReachable` tells us whether this specific Norish backend is reachable.
- `appOnline` tells TanStack Query and auth/session logic whether live server work should proceed.
- `runtimeState` tells the bootstrap layer whether the app has enough information to trust one of the three visible reachability modes yet.

**Why not just WebSocket status?** WebSocket state can be disconnected while HTTP is still healthy, and vice versa. It is a live-sync signal, not a full reachability model.

**Why not just `expo-network`?** It cannot tell whether the saved Norish backend URL is reachable.

### 2. Backend reachability comes from an explicit health probe lifecycle

**Decision**: `backendReachable` will be derived from `GET /api/health` against the configured backend URL, not inferred from generic HTTP failures. Health probes run:

1. On startup after the backend base URL is loaded.
2. When the device transitions `offline -> online`.
3. When the app returns to the foreground.
4. On a lightweight interval while the app is active and `deviceOnline === true`.

**Flap control**: Mark the backend unreachable only after a small failure threshold (for example, 2 consecutive failed probes or timeouts). Mark it reachable on the first successful probe. This avoids thrashing the UI during short-lived network hiccups.

**Why**: Using explicit probes gives us a reliable answer for wrong backend URLs, sleeping dev servers, captive portals, or backend outages without conflating those cases with true device-offline mode.

### 3. TanStack Query `onlineManager` uses `appOnline`, not raw device state

**Decision**: In the mobile entrypoint, call `onlineManager.setEventListener(...)` from the reachability layer and feed it `appOnline`.

**Why**: If the phone reports connectivity but the backend is unreachable, we want queries to pause and cached data to remain stable rather than repeatedly firing failing requests.

**Consequence**: TanStack Query's idea of "online" becomes "the Norish app can currently reach its backend," not merely "the device has some network connectivity." This is intentional for mobile UX.

### 4. Persistent query cache is restored before authenticated app content mounts

**Decision**: Use `@tanstack/query-persist-client-core` with a dedicated MMKV instance (`id: 'norish-query-cache'`) and restore the persisted cache before authenticated query consumers render. The mobile shell should hard-gate the authenticated app content on cache hydration readiness, and the reachability layer should remain in `runtimeState: 'initializing'` until the first restore/probe pass settles.

**Why a separate MMKV instance?** The cache can grow independently and must be clearable without disturbing preferences or other local state.

**Why a hard gate?** Persisting without restoring early produces the worst possible offline experience: the app boots into loading/error states and only later discovers cached data. A hard gate makes offline cold start feel intentional and prevents bootstrap uncertainty from leaking into visible reachability UI.

**Key configuration:**

- `maxAge`: 24 hours (1000 x 60 x 60 x 24)
- `buster`: app version string
- dehydrate filter: persist only successful queries; skip errors and mutations

### 5. Externalize QueryClient creation from the shared bundle

**Decision**: Extend `createTRPCProviderBundle` to optionally accept a pre-built `QueryClient` (or factory callback). Mobile creates the `QueryClient`, restores persistence, and passes it into the shared bundle. Web continues using the internal client.

**Why**: Mobile needs to own cache restore timing and persistence wiring, but we do not want to duplicate the tRPC link setup or let the mobile provider drift from the shared implementation.

### 6. Cache invalidation and cache clearing are both first-class behaviors

**Decision**:

1. On `appOnline: false -> true`, invalidate stale queries so fresh data refetches automatically.
2. On sign-out, clear both the in-memory query cache and the persisted MMKV cache.
3. On backend URL change, clear both the in-memory query cache and the persisted MMKV cache before reconnecting to the new backend.

**Why**: Invalidation handles freshness. Clearing handles privacy and environment boundaries. These solve different problems and both are required.

### 7. Auth re-validation happens only when the app is truly back online

**Decision**: Session re-validation listens for `appOnline: false -> true`, then:

1. Calls `authClient.getSession()`.
2. If the response authoritatively indicates no valid session (null session / 401 / revoked), call `signOut()`.
3. If the check fails because the backend is still unreachable or probe timing is still settling, do not sign out; retry on the next `appOnline` restore.

**Why**: Better Auth uses server-authoritative cookies. The correct reconnect boundary is "backend reachable again," not merely "device has a network interface again."

### 8. Reachability indicator is shell-level and mode-specific

**Decision**: A shell-level banner rendered inside the authenticated app wrapper will map reachability mode to messaging:

- `offline` -> "You're offline - showing cached data"
- `backend-unreachable` -> "Can't reach the Norish server - showing cached data"
- `online` -> no banner

The hidden `runtimeState: 'initializing'` does not get its own banner. During that phase the app stays in bootstrap/loading treatment until the visible mode can be classified honestly.

**Why shell-level?** It avoids duplicating the same signal across tabs and keeps the experience coherent during navigation.

### 9. Mutation behavior must remain non-queueing even though `onlineManager` becomes backend-aware

**Decision**: This change does not introduce deferred mutation replay. Because `onlineManager` will report `false` when `backendReachable === false`, mutation behavior must be reviewed explicitly so we do not accidentally create a silent write queue. The desired v1 behavior is fail-fast or pre-emptively disabled mutation entry points, not background replay.

**Why this matters**: Queries pausing on backend loss is desirable. Silent mutation replay is not part of this foundation and would be a product-level behavior change.

## Risks / Trade-offs

- **Startup delay** -> Hard-gating authenticated content on cache restore (and possibly initial reachability check) adds a small boot delay. **Mitigation**: gate only the authenticated app shell, keep the loading state minimal, and prefer cached-content readiness over spinner-first UX.
- **False backend-unreachable state** -> A single failed heartbeat could incorrectly degrade the app. **Mitigation**: consecutive-failure threshold plus immediate recovery on first successful probe.
- **Large cache size** -> MMKV is fast, but serializing a large query cache can still create work on the JS side. **Mitigation**: separate MMKV instance, success-only persistence, debounced writes, tune dehydrate filters as needed.
- **Cache privacy leaks across users/backends** -> Persisted data could outlive auth changes. **Mitigation**: clear in-memory and persisted caches on sign-out and backend URL change.
- **Reachability-model complexity** -> The app now has `deviceOnline`, `backendReachable`, `appOnline`, and `wsConnected`. **Mitigation**: define clear responsibilities: `appOnline` drives query/auth behavior, banner uses `mode`, WebSocket remains subscription diagnostics only.

## Open Questions

1. **How aggressive should the health-check cadence be?** We still need to settle interval length, timeout length, and whether foreground checks should bypass the normal debounce window.
2. **How should mutations behave when `appOnline === false`?** The intended v1 behavior is non-queueing, but we still need to choose whether to disable key actions in the UI, throw a local reachability error from mutation wrappers, or both.
3. **Should the reachability banner be dismissible?** A persistent banner may annoy intentional offline use, but dismissing it too easily may hide important context.
