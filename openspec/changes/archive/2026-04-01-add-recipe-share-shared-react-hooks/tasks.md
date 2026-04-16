## 1. Realtime Share Contracts

- [x] 1.1 Add typed recipe-share lifecycle subscription events and router subscriptions in `packages/trpc`.
- [x] 1.2 Emit create, update, revoke, and delete share events with `emitByPolicy` using the recipe view visibility scope.
- [x] 1.3 Add or update shared contract types needed for recipe-share subscription payloads.

## 2. Shared-React Recipe Share Hooks

- [x] 2.1 Add a `packages/shared-react/src/hooks/recipes/shares` hook family for authenticated share list/query and share lifecycle mutations.
- [x] 2.2 Add shared-react cache helpers and a share subscription hook that invalidates the affected recipe-share queries when realtime events arrive.
- [x] 2.3 Add a shared-react query hook for resolving public shared recipes by token.
- [x] 2.4 Export the new share hooks through the existing recipe hook factory and package entrypoints.

## 3. Context Integration

- [x] 3.1 Extend `createRecipeDetailContext` with optional recipe-share adapters and context fields for share state and actions.
- [x] 3.2 Wire the new share hooks into the shared recipe detail flow without introducing UI-specific behavior.

## 4. Verification

- [x] 4.1 Add or update shared-react tests covering exports and recipe detail context share wiring.
- [x] 4.2 Add tests for subscription-driven share query invalidation and visibility-scoped realtime behavior.
- [x] 4.3 Run the relevant shared-react and trpc test suites and fix any regressions.
