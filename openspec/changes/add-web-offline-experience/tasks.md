## 1. Persistent Web Read-Cache Foundation

- [ ] 1.1 Add a dedicated IndexedDB read-cache database with schema versioning, cache buster, backend-origin scope, user scope, household context, timestamps, and byte accounting.
- [ ] 1.2 Add a web QueryClient persister or selected-query snapshot adapter that persists successful allowlisted queries without changing mobile persistence behavior.
- [ ] 1.3 Add restore gating so authenticated query consumers see restored data before their first render while the shell remains responsive.
- [ ] 1.4 Add stale-data metadata, retention rules, quota handling, and explicit partial-cache states.
- [ ] 1.5 Add sign-out, user-switch, backend-origin, and household-context cache isolation/cleanup behavior.

## 2. Offline App Shell and Render Identity

- [ ] 2.1 Add a safe service-worker navigation fallback for application routes when network delivery fails.
- [ ] 2.2 Add a deterministic first-run offline fallback when no safe application shell has been cached.
- [ ] 2.3 Add last-confirmed user/session render identity restoration without treating cached identity or permissions as authorization.
- [ ] 2.4 Add reconnect session revalidation and cache/outbox quarantine behavior for missing, expired, or changed sessions.
- [ ] 2.5 Remove or narrow personalized API response caching in the service worker so explicit IndexedDB snapshots are the offline read source of truth.

## 3. Full Recipe, Meal-Plan, and Grocery Hydration

- [ ] 3.1 Persist the canonical first 100 recipe dashboard records and their source query metadata.
- [ ] 3.2 Add bounded, non-blocking full-recipe detail hydration for the canonical 100 recipe IDs.
- [ ] 3.3 Add recipe-detail availability tracking so incomplete hydration is never presented as fully offline-ready.
- [ ] 3.4 Persist the exact current-week calendar range and grocery-list response, including recurring groceries and recipe-name mappings.
- [ ] 3.5 Add scoped recipe image caching with byte limits, eviction, and visible storage-pressure behavior.
- [ ] 3.6 Add focused tests for cold offline boot, full recipe hydration, partial hydration, stale snapshots, week rollover, grocery updates, quota failure, and user isolation.

## 4. Reachability and Queue Status UX

- [ ] 4.1 Add web reachability state for initializing, offline, backend-unreachable, and online modes using browser and authenticated HTTP signals.
- [ ] 4.2 Add the avatar connectivity indicator with yellow offline/backend-unreachable priority over update-available status.
- [ ] 4.3 Keep queued-count badges separate from the connectivity dot and expose pending/retrying counts while offline or online.
- [ ] 4.4 Replace or extend the floating outbox status with an accessible avatar-launched queue view showing all active and attention states.
- [ ] 4.5 Add safe retry/discard actions, completed-delivery result handling, and non-blocking recovery feedback.
- [ ] 4.6 Add cross-tab, window, and service-worker status propagation with focused UI and race-condition tests.

## 5. Closed-PWA Background Sync Planning Gate (Separate Task)

- [ ] 5.1 Produce a browser/PWA capability matrix for one-off Background Sync, service-worker lifetime limits, cookie-authenticated fetches, and the explicitly supported versus best-effort platforms.
- [ ] 5.2 Define and review the worker-safe replay transport for JSON and FormData/Blob payloads, preserving the existing operation ID, receipt headers, encryption, and payload codecs.
- [ ] 5.3 Define and review cross-context queue ownership using a durable lease or Web Locks-compatible mechanism, including crash recovery and service-worker/window races.
- [ ] 5.4 Define authentication/session validation, user-scope quarantine, terminal-state handling, client notification, and next-launch fallback behavior.
- [ ] 5.5 Define the feature flag, observability, manual closed-PWA test matrix, and rollback criteria before enabling service-worker replay.

## 6. Closed-PWA Background Replay

- [ ] 6.1 Register a deduplicated Norish Background Sync tag after durable mutation enqueue when the capability is available.
- [ ] 6.2 Implement service-worker replay against the existing outbox without creating a second queue or generating replacement operation IDs.
- [ ] 6.3 Implement authentication scope checks, durable replay leases, strict FIFO, retry/backoff, receipt duplicate handling, and terminal/quarantine updates.
- [ ] 6.4 Notify controlled clients after service-worker outbox state changes and expose durable outcomes after reopening.
- [ ] 6.5 Keep active-app and next-launch replay as fallbacks when Background Sync is unsupported, rejected, or disabled.
- [ ] 6.6 Add supported-browser integration coverage for a completely closed PWA, interrupted worker execution, concurrent foreground replay, authentication expiry, and unsupported-browser fallback.

## 7. Validation and Rollout

- [ ] 7.1 Add manual smoke coverage for first online boot, offline reload, offline navigation, full recipe access, current-week meals, groceries, queued writes, avatar priority, and reconnect convergence.
- [ ] 7.2 Validate storage cleanup on sign-out and user switch, including service-worker media caches and persisted query snapshots.
- [ ] 7.3 Validate feature-flag rollback without deleting pending mutation outbox entries or corrupting read-cache state.
- [ ] 7.4 Run scoped tests, type checking, build, lint, format, dependency-cycle checks, OpenSpec validation, and diff checks.
- [ ] 7.5 Document browser capability limitations, freshness semantics, media budgets, closed-PWA replay behavior, and recovery actions in the web technical documentation.
