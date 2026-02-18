## 1. Branch and Baseline

- [x] 1.1 Ensure implementation branch is created from a commit that contains PR #284 (`feature/user-settings`) before code changes begin.
- [x] 1.2 Capture baseline behavior by running current user-hook and user-settings tests.

## 2. User Hook Pattern Alignment

- [ ] 2.1 Add a user cache-helper hook (observer-free cache mutation) and export it from `hooks/user/index.ts`.
- [ ] 2.2 Refactor `use-user-query.ts` to expose typed data and tRPC-derived query keys only.
- [ ] 2.3 Refactor `use-user-mutations.ts` to consume cache helpers instead of `useUserSettingsQuery()` and remove hardcoded query keys.
- [ ] 2.4 Remove unsafe preference casts from user/config consumers and replace with typed preference access.

## 3. Context Boundary Cleanup

- [ ] 3.1 Refactor `app/(app)/settings/user/context.tsx` to rely on refactored hooks without duplicating user state ownership.
- [ ] 3.2 Reconcile interactions with `context/user-context.tsx` so profile/preference updates follow one deterministic sync path.

## 4. Testing and Regression Coverage

- [ ] 4.1 Update user hook test mocks to use real tRPC key shapes and verify rollback/invalidation behavior.
- [ ] 4.2 Add/adjust tests for settings context + preferences card flows impacted by typed preference handling.
- [ ] 4.3 Run targeted test suites for user hooks and settings components.

## 5. Validation

- [ ] 5.1 Run repository checks required for this frontend refactor (`pnpm lint`, targeted `pnpm test:run` scopes).
- [ ] 5.2 Run `openspec validate refactor-user-hooks-context-pattern --strict --no-interactive`.
