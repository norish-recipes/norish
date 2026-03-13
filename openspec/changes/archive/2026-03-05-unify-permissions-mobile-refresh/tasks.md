## 1. Shared permissions/settings hook contract

- [x] 1.1 Add permissions/server-settings hook factories in `@norish/shared-react` using app-injected typed `useTRPC` bindings.
- [x] 1.2 Define and export normalized shared return types/selectors needed for AI and delete gating.
- [x] 1.3 Add unit tests for shared hook factory behavior, normalization, and injection boundaries.

## 2. Web migration to shared contract

- [x] 2.1 Refactor `apps/web/hooks/permissions/use-permissions-query.ts` to consume shared-react permissions/server-settings hooks.
- [x] 2.2 Update `apps/web/context/permissions-context.tsx` wrappers to preserve current consumer API while sourcing from shared hooks.
- [x] 2.3 Validate web parity by running existing web permission-aware flows and fixing regressions.

## 3. Mobile permission-aware action gating

- [x] 3.1 Add mobile wrapper hooks/providers that bind mobile `useTRPC` to shared permission/server-settings hook factories.
- [x] 3.2 Update mobile AI action surfaces to hide AI controls when server settings/permissions disable AI.
- [x] 3.3 Update mobile delete action surfaces to hide delete controls when delete permission is not granted, including conservative hidden state during loading.

## 4. Mobile pull-to-refresh implementation

- [x] 4.1 Identify initial in-scope mobile list/feed screens and wire native pull-to-refresh controls.
- [x] 4.2 Connect pull-to-refresh handlers to the relevant query invalidation/refetch paths for each screen.
- [x] 4.3 Ensure refresh state UX prevents overlapping refresh requests and correctly clears on success/failure.

## 5. Verification and rollout safety

- [x] 5.1 Add/update mobile tests covering AI/delete visibility gating and pull-to-refresh behavior.
- [ ] 5.2 Run targeted web/mobile test suites and perform manual QA for permission-state transitions and refresh flows.
- [x] 5.3 Document migration notes and any follow-up cleanup tasks for remaining app-local permission logic.
