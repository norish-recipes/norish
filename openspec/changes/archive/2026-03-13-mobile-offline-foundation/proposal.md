## Why

The mobile app currently behaves as though "online" is a single binary state. In practice, mobile users hit at least three distinct conditions: the device can be offline, the device can be online while the configured Norish backend is unreachable, or everything can be reachable. Today those cases collapse into loading spinners, request failures, and confusing error states. For a recipe app used in kitchens (often with poor WiFi, flaky local servers, or changing home-network conditions), this is a critical gap. We need a mobile offline foundation that distinguishes those states, keeps the user authenticated during outages, restores cached data before the authenticated app renders, and reconciles automatically when the backend becomes reachable again.

## What Changes

- **Three-state reachability context + hook**: A new `NetworkProvider` / `useNetworkStatus()` built on `expo-network` plus backend health checks that exposes `deviceOnline`, `backendReachable`, derived `appOnline`, and a reachability mode such as `offline | backend-unreachable | online`. Internally it also tracks a hidden bootstrap runtime state (for example `initializing | ready`) so startup restore/probe work is not confused with a user-visible offline state. This becomes the single source of truth for mobile reachability.
- **Backend-aware `onlineManager` integration**: Wire the derived `appOnline` state into TanStack Query's `onlineManager` so queries pause not only when the device is offline, but also when the configured backend is unreachable.
- **TanStack Query cache persistence with startup restore gate**: Integrate `@tanstack/query-persist-client-core` with an MMKV-backed persister so the query cache is written to disk and restored before authenticated query consumers render. On cold start while offline or backend-unreachable, previously-fetched data should be available immediately.
- **Offline-aware auth**: The auth session cookie is already persisted in `expo-secure-store`, so logins survive restarts. Add logic so that when `appOnline` is restored, the auth context silently re-validates the session against the server and triggers sign-out only when the session is authoritatively invalid.
- **Reachability indicator banner**: A shell-level banner that differentiates between "device offline" and "backend unreachable," replacing confusing loading/error states with clear messaging while cached data remains visible.
- **Cache invalidation and cache clearing boundaries**: When `appOnline` is restored, invalidate stale queries so fresh data is fetched automatically. Also clear the persisted query cache on sign-out and backend URL change so cached user or household data cannot leak across accounts or environments.

## Capabilities

### New Capabilities

- `mobile-network-status`: Device connectivity detection, backend reachability checks, app-online derivation, and TanStack Query `onlineManager` integration.
- `mobile-offline-cache`: MMKV-backed TanStack Query cache persistence, hard-gated cache hydration on cold start, invalidation-on-reconnect logic, and cache clearing boundaries.
- `mobile-offline-auth`: Session re-validation when the backend becomes reachable again, automatic sign-out when the session is expired/revoked, and offline-tolerant auth flow.
- `mobile-offline-indicator`: Shell-level reachability banner component with distinct offline and backend-unreachable states and i18n support.

### Modified Capabilities

- `mobile-trpc-integration`: The shared tRPC provider bundle's `QueryClient` setup will be extended to accept an externally-created client so the mobile app can restore persisted cache before rendering and drive reachability from `appOnline` rather than relying solely on WebSocket status.

## Impact

- **`apps/mobile`** — New reachability provider, health-check lifecycle, cache bootstrap/hydration gate, UI banner, and provider-tree wiring.
- **`packages/shared-react`** — Minor extension to `createTRPCProviderBundle` to allow an externally-supplied `QueryClient` so the mobile side can restore persistence before rendering without duplicating the shared tRPC setup.
- **Dependencies** — Add `@tanstack/query-persist-client-core` (or `@tanstack/react-query-persist-client`) to `apps/mobile`. `expo-network` is already installed.
- **No backend changes** — This is entirely a mobile-client concern; backend reachability uses the existing `/api/health` endpoint and session validation uses the existing Better Auth `/api/auth/get-session` endpoint.
