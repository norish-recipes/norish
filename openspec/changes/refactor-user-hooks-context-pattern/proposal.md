# Change: Refactor user hooks to match domain hook patterns

## Why

The `use-user-*.ts` hooks currently mix query observers, cache writes, and context synchronization in ways that differ from established hook patterns used by recipes and stores. This makes behavior harder to reason about and has already introduced reliability and typing issues around preference updates.

## What Changes

- Refactor user hooks to follow the same structural pattern as `use-recipes-*` and `use-stores-*` hooks: query hooks for reading, cache-helper hooks for observer-free cache mutation, and mutation hooks focused on command operations.
- Remove hardcoded React Query keys from user mutation flows and require all cache operations to use tRPC-derived query keys.
- Define a single source of truth for user settings data in React Query cache so user settings context does not compete with top-level user context state.
- Replace untyped preference access (`as any`) in user hooks/config consumers with typed preference reads and updates.
- Align tests with real tRPC key structures and add regression coverage for rollback, invalidation, and context synchronization.
- Keep compatibility with branch work from PR #284 while cleaning up architectural debt introduced during preference rollout.

## Impact

- Affected specs: `user-hooks`
- Affected code:
  - `hooks/user/use-user-query.ts`
  - `hooks/user/use-user-mutations.ts`
  - `hooks/user/use-active-allergies.ts`
  - `hooks/user/index.ts`
  - `hooks/config/use-timers-enabled-query.ts`
  - `app/(app)/settings/user/context.tsx`
  - `app/(app)/settings/user/components/preferences-card.tsx`
  - `context/user-context.tsx`
  - `__tests__/hooks/user/*`
  - `__tests__/app/settings/user/*`
