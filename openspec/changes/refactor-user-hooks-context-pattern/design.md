## Context

The current user hook stack diverges from the project's proven hook architecture used by recipes and stores. Deep inspection highlights several concrete issues:

- `hooks/user/use-user-mutations.ts` imports `useUserSettingsQuery()` and therefore creates query observers inside a mutation hook. This is the same class of coupling that recipes/stores solved via dedicated cache-helper hooks.
- `hooks/user/use-user-mutations.ts` uses a hardcoded `queryKey = ["user", "get"]` for rollback while also using tRPC-generated keys elsewhere, creating a risk of cache misses when key structure changes.
- `hooks/user/use-user-mutations.ts`, `hooks/config/use-timers-enabled-query.ts`, and `app/(app)/settings/user/components/preferences-card.tsx` rely on `as any` for preference reads/writes.
- `app/(app)/settings/user/context.tsx` updates both React Query-backed settings state and `context/user-context.tsx` optimistic state, creating multiple write paths for overlapping user fields.
- Existing tests use simplified key mocks that can mask key-shape regressions and do not enforce parity with tRPC query-key structure.

These issues became more visible after the user preferences work in PR #284, where preference mutation and context synchronization are now critical paths.

## Goals / Non-Goals

- Goals:
  - Align user hooks with the established query/mutation/cache-helper pattern.
  - Make tRPC-derived query keys the only source for cache writes and invalidations.
  - Remove `any` usage from user preference handling paths.
  - Clarify ownership boundaries between user settings context and top-level user context.
  - Add regression tests for rollback and key-shape correctness.
- Non-Goals:
  - Redesigning user-facing settings UX or adding new preference fields.
  - Changing server API contracts introduced in PR #284.
  - Rewriting unrelated domain contexts.

## Decisions

- Decision: Introduce a `use-user-cache` helper hook mirroring recipes/stores cache helper design.
  - Rationale: Mutations and subscriptions (future-safe) need cache mutation without creating query observers.

- Decision: Refactor `use-user-mutations` to depend on cache helpers (and explicit inputs) instead of `useUserSettingsQuery()`.
  - Rationale: Eliminates observer coupling and makes mutation behavior deterministic.

- Decision: Keep existing user settings context external API stable for consumers while changing internals to rely on the refactored hooks.
  - Rationale: Limits blast radius and enables incremental rollout.

- Decision: Treat React Query `user.get` data as the canonical settings source; top-level user context should only hold auth/session identity and explicitly derived optimistic values.
  - Rationale: Prevents split-brain state between settings and global user context.

- Decision: Add typed user preference access utilities (or equivalent typed narrowing) for `timersEnabled` and `showConversionButton` reads/writes.
  - Rationale: Removes unsafe casts and aligns with project typing standards.

## Risks / Trade-offs

- Risk: Refactoring hook contracts can break settings components/tests that depend on current async function signatures.
  - Mitigation: Keep context contract stable and migrate internals behind it.

- Risk: Changing user-context synchronization might regress avatar/name update behavior.
  - Mitigation: Add targeted tests around profile updates and cache->context propagation.

- Risk: Stricter tRPC key handling may expose latent test assumptions.
  - Mitigation: Update test utilities to use realistic key structures and verify rollback keys explicitly.

## Migration Plan

1. Add user cache helper module and tests.
2. Refactor user query/mutation hooks to use shared typed cache utilities.
3. Update settings context and preference consumers to typed access and single-source synchronization.
4. Update tests/mocks for tRPC key parity and rollback behavior.
5. Run hook/settings test suites and full OpenSpec validation.

## Open Questions

- None required for proposal approval; implementation can preserve current consumer-facing context API while refactoring internals.
