## Why

The backend now supports public recipe share links, but web and mobile still lack a shared client-side contract for managing those links and reacting to share-state changes. We need `shared-react` hooks and contexts that expose the share APIs consistently and keep recipe/share state synchronized over WebSockets without relying on optimistic updates.

## What Changes

- Add shared-react recipe-share hooks for listing, creating, updating, revoking, deleting, and resolving shared recipes so both web and mobile can consume the same client contract.
- Add shared-react cache helpers and subscription wiring for recipe-share lifecycle events, following the repo's existing mutation -> server event -> WebSocket -> React Query pattern.
- Update shared recipe contexts and detail-facing hooks so share metadata can be consumed without adding platform-specific state management in app code.
- Add visibility-aware realtime synchronization so share-link lifecycle changes refresh the right audience based on the recipe view policy (`everyone`, `household`, or `owner`).
- Add focused tests for hook exports, cache invalidation/update behavior, and subscription-driven synchronization. No UI is included in this change.

## Capabilities

### New Capabilities

- `recipe-share-react-state`: Provide cross-platform `shared-react` hooks, contexts, and realtime cache synchronization for authenticated recipe-share management and shared recipe resolution.

### Modified Capabilities

- None.

## Impact

- Affected code: `packages/shared-react` hooks, contexts, exports, and tests; `packages/trpc` recipe share subscriptions/events where needed; and shared contracts/types used by the subscription payloads.
- Affected APIs: client-facing hook/context APIs for recipe sharing plus any new subscription events required to sync share lifecycle state.
- Dependencies/systems: TanStack Query cache helpers, tRPC WebSocket subscriptions, recipe visibility policy emission rules, and existing recipe dashboard/detail shared-react patterns.
- Behavioral impact: share-link changes will propagate asynchronously through realtime events instead of local optimistic updates, keeping visible users in sync across web and mobile.
