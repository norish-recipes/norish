## 1. Persisted Session Reader

- [x] 1.1 Add `readPersistedSession()` to `apps/mobile/src/lib/auth-storage.ts` that reads the `norish_session_data` key from `expo-secure-store`, parses the JSON, extracts the `user` object (`id`, `email`, `name`, `image`), and returns it — or returns `null` if the key is missing, empty, or unparseable. Log parse failures at `warn` level using the Pino logger.
- [x] 1.2 Add strict runtime validation in `readPersistedSession()` for required fields (`id`, `email`, `name` as non-empty strings; `image` optional nullable string). Treat any shape mismatch as corrupted and return `null` without throwing.
- [x] 1.3 Ensure warn logs for malformed session payloads do not include raw SecureStore session JSON (avoid leaking sensitive data in client logs).

## 2. Network-Aware Auth Context

- [x] 2.1 Update `AuthProviderInner` in `apps/mobile/src/context/auth-context.tsx` to consume `useNetworkStatus()` (`backendReachable`, `runtimeState`) and select auth source explicitly:
  - `runtimeState === 'initializing'`: keep auth in loading/transitional state, do not force SecureStore fallback yet
  - `runtimeState === 'ready' && backendReachable === false`: read persisted session via `readPersistedSession()` and use as offline source
  - `backendReachable === true`: use live `authClient.useSession()` as authoritative source
- [x] 2.2 Define transition behavior for reachability changes in `AuthProviderInner` so `isAuthenticated` does not flicker during quick startup/connect transitions (`false -> true` backend reachability).
- [x] 2.3 Keep `AuthProviderInner` under a strict `NetworkProvider` invariant (no optional fallback hook behavior). Preserve existing `backendBaseUrl: null` short-circuit behavior in `AuthProvider` for onboarding/no-backend mode.

## 3. Provider Ordering Verification

- [x] 3.1 Verify in `apps/mobile/src/app/_layout.tsx` that `NetworkProvider` wraps `AuthProvider` in the full provider tree (it already does at lines 84–94). Confirm no circular dependency issues arise from `AuthProvider` consuming network state.
- [x] 3.2 Document in change notes that this provider ordering is a hard requirement for offline auth bypass behavior.

## 4. Cross-Change Alignment

- [x] 4.1 Reconcile with `mobile-offline-resilience` offline-auth direction: explicitly note in that change (or this one) whether SecureStore session reads are temporary, permanent, or superseded by MMKV session snapshot.
- [x] 4.2 If supersession is intended, add follow-up cleanup tasks (single source of truth, removal of redundant session cache path, migration behavior).

## 5. Validation & Testing

- [x] 5.1 Run TypeScript type-check (`tsc --noEmit`) across the mobile app to confirm no type errors.
- [x] 5.2 Add unit tests for `readPersistedSession()` covering valid payload, missing key, empty payload, malformed JSON, and invalid user shape.
- [x] 5.3 Add auth-context behavior tests (or equivalent hook tests) for source switching:
  - cold start unreachable + persisted session => authenticated
  - cold start reachable => live session path
  - reachable -> unreachable -> reachable transitions preserve stable auth behavior and return to live source
- [x] 5.4 _(manual)_ Manual verify: cached session + backend unreachable => user lands in `(tabs)`; reconnect with revoked session => `useSessionRevalidation` signs out.
- [x] 5.5 _(manual)_ Manual verify startup with reachable backend but delayed websocket connect does not create a visible auth flicker.
