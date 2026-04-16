## 1. Dependencies & Setup

- [x] 1.1 Add `@tanstack/query-persist-client-core` to `apps/mobile/package.json` and run `pnpm install`
- [x] 1.2 Create a dedicated MMKV instance for query cache at `apps/mobile/src/lib/storage/query-cache-mmkv.ts` (id: `norish-query-cache`)

## 2. Reachability Provider

- [x] 2.1 Create `apps/mobile/src/context/network-context.tsx` with `NetworkProvider` and `useNetworkStatus()` built on `expo-network`
- [x] 2.2 Expose `deviceOnline`, `backendReachable`, `appOnline`, and a reachability `mode` (`offline | backend-unreachable | online`) from the context, while internally tracking a bootstrap runtime state (for example `initializing | ready`) so startup restore/probe work is not surfaced as a visible fourth mode
- [x] 2.3 Add a backend health-check service using `getBackendHealthUrl()` that probes `GET /api/health` for the saved backend URL
- [x] 2.4 Trigger backend health checks on startup, device offline→online transitions, app foreground, and a lightweight interval while the app is active and device-online
- [x] 2.5 Add consecutive-failure / timeout handling so `backendReachable` does not flap on a single transient error
- [x] 2.6 Wire TanStack Query `onlineManager.setEventListener` from `NetworkProvider` using derived `appOnline`
- [x] 2.7 Mount `NetworkProvider` in the root `_layout.tsx` above `TrpcProvider` and `AuthProvider`

## 3. Externalize QueryClient in Shared tRPC Provider

- [x] 3.1 Extend `CreateTRPCProviderBundleOptions` in `packages/shared-react/src/providers/trpc-provider.tsx` to accept an optional `queryClient` (or `getQueryClient` callback)
- [x] 3.2 Update `TRPCProviderWrapper` to use the externally-provided `QueryClient` when supplied, falling back to the internal one (preserving existing web behavior)
- [x] 3.3 Verify web app builds and runs correctly with no behavioral change (no external client supplied)

## 4. MMKV Query Cache Persister & Hydration Gate

- [x] 4.1 Create `apps/mobile/src/lib/query-cache/mmkv-persister.ts` — a thin adapter implementing `Persister` interface from `@tanstack/query-persist-client-core` backed by the `norish-query-cache` MMKV instance
- [x] 4.2 Create `apps/mobile/src/lib/query-cache/create-persisted-query-client.ts` — factory function that creates a `QueryClient`, restores persisted cache before first use, then subscribes persistence with `maxAge: 24h`, `buster: appVersion`, and `dehydrateOptions` filtering to `success`-only queries
- [x] 4.3 Update `apps/mobile/src/providers/trpc-provider.tsx` to use the factory from 4.2, passing the pre-configured `QueryClient` to `createTRPCProviderBundle` via the new `getQueryClient` option
- [x] 4.4 Expose hydration/bootstrap readiness from the mobile query-client bootstrap so authenticated query consumers can be hard-gated until restore finishes and the reachability layer can transition out of its internal `initializing` runtime state
- [x] 4.5 Update the root mobile layout to delay authenticated app content until persisted query cache restoration completes

## 5. Cache Invalidation & Clearing Boundaries

- [x] 5.1 In the mobile `TrpcProvider` (or a new wrapper), subscribe to `appOnline: false -> true` and call `queryClient.invalidateQueries()` when the backend becomes reachable again
- [x] 5.2 Ensure the existing WebSocket-based invalidation in `createTRPCProviderBundle` still fires (both signals should coexist — app-level reachability and WS-level live sync)
- [x] 5.3 Clear the in-memory and persisted query cache on sign-out so cached user/household data cannot leak across accounts
- [x] 5.4 Clear the in-memory and persisted query cache when the backend base URL changes so cached data cannot leak across environments

## 6. Offline-Aware Auth (Session Re-validation)

- [x] 6.1 Create `apps/mobile/src/hooks/use-session-revalidation.ts` — a hook that listens for `appOnline: false -> true` and calls `authClient.getSession()` to verify the session is still valid
- [x] 6.2 On invalid/expired session response, call `signOut()` from the auth context; on ambiguous reachability errors, skip sign-out and retry on the next app-online transition
- [x] 6.3 Mount the `useSessionRevalidation` hook inside `AuthProviderInner` (or a dedicated wrapper component rendered within the auth-gated tree)

## 7. Reachability Indicator Banner

- [x] 7.1 Create `apps/mobile/src/components/shell/offline-banner.tsx` — a compact, single-line banner component that reads `useNetworkStatus()` and renders different content for `offline` vs `backend-unreachable`, while remaining hidden during the internal bootstrap runtime state
- [x] 7.2 Add i18n keys for both banner states (for example `offline.banner.*` and `serverUnreachable.banner.*`) across all supported locales
- [x] 7.3 Render `OfflineBanner` inside `AuthGatedProviders` in `_layout.tsx` so it appears across all authenticated tabs when `mode !== 'online'`

## 8. Mutation Behavior While App Is Not Reachable

- [x] 8.1 Audit the current mobile mutation entry points and document which actions must fail fast or be disabled while `appOnline === false`
- [x] 8.2 Introduce a shared reachability guard for mobile mutation flows so this foundation does not accidentally create a silent deferred-write queue

## 9. Testing & Verification

- [x] 9.1 Write unit tests for `mmkv-persister.ts` (serialize/deserialize round-trip, error handling)
- [x] 9.2 Write unit tests for cache hydration bootstrap (restore-before-render behavior and cache-clear paths)
- [x] 9.3 Write unit tests for `useNetworkStatus` / `NetworkProvider` (mock `expo-network`, health probes, app foreground, failure thresholds, and the `offline | backend-unreachable | online` state matrix)
- [x] 9.4 Write unit tests for `useSessionRevalidation` (mock app-online transitions, verify signOut called on invalid session, no signOut on ambiguous reachability failure)
- [x] 9.5 Manual verification: kill device network in iOS simulator -> confirm offline banner appears, cached data stays visible, new queries pause
- [x] 9.6 Manual verification: keep device online but stop/repoint backend -> confirm server-unreachable banner appears, cached data stays visible, new queries pause without hammering the backend
- [x] 9.7 Manual verification: restore backend reachability -> confirm queries refresh, session revalidates, and banner disappears
