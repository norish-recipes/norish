## Context

The public recipe sharing backend is in place, but `packages/shared-react` does not yet expose any recipe-share hook family, share-aware contexts, or subscription wiring for that workflow. The repo already has a strong client pattern for realtime state: hooks are created from `create*Hooks` factories, mutations write through tRPC, subscriptions are normalized in the provider layer, and React Query cache helpers fan out invalidation/update logic across detail and list queries.

This change is cross-cutting because it touches shared hook exports, recipe detail context wiring, and recipe-share lifecycle events in tRPC so authenticated clients can stay in sync when shares change. It also needs to respect the existing recipe visibility policy (`everyone`, `household`, `owner`) and avoid optimistic share-state writes, because the visible audience depends on the server-side policy decision.

## Goals / Non-Goals

**Goals:**

- Add a reusable recipe-share hook family in `packages/shared-react` for authenticated share management and public shared recipe resolution.
- Extend shared client state so recipe-share data can be consumed through existing shared context patterns instead of app-local wiring.
- Synchronize share lifecycle changes through WebSocket subscriptions, scoped by the recipe view policy.
- Use server-confirmed invalidation/refetch flows rather than optimistic share updates.
- Add focused tests for exports, hook behavior, and subscription-driven cache refresh.

**Non-Goals:**

- Building any web or mobile share UI.
- Reworking the backend share persistence model or public token contract.
- Introducing optimistic share-link creation/update behavior.
- Redesigning recipe list/detail DTOs beyond the minimum needed for share-state synchronization.

## Decisions

### Decision: Add a dedicated recipe-share hook family under the shared recipe domain

Create a new hook family under `packages/shared-react/src/hooks/recipes/shares` and expose it through the existing `createRecipeHooks` surface so web and mobile consume share behavior the same way they already consume dashboard/detail recipe hooks.

Rationale: the existing shared-react recipe hooks are organized by recipe domain, and share management belongs beside those hooks instead of in app-specific code or a disconnected top-level package.

Alternatives considered:

- Add standalone app-level hooks in `apps/web` and `apps/mobile`: rejected because the user explicitly wants a shared implementation and it would duplicate cache/subscription logic.
- Put share hooks in an unrelated top-level `hooks/recipe-shares` folder: rejected because it breaks the current recipe hook factory pattern and makes dependency injection less consistent.

### Decision: Prefer cache invalidation helpers over optimistic share cache mutation

Share lifecycle hooks will expose normal query and mutation state, but their synchronization model will be server-confirmed: mutation success updates the initiating client from the returned payload where practical, and all broader synchronization will happen by invalidating/refetching share queries when share events arrive.

Rationale: whether other clients should observe a share change depends on the server-side recipe visibility policy, so optimistic fan-out is both incomplete and hard to reason about. Invalidating the relevant share queries is simpler and matches the repo's realtime pattern.

Alternatives considered:

- Fully optimistic share list updates: rejected because the server decides visibility scope and share lifecycle side effects.
- Manual cache patching for every share query shape on every event: rejected because it is brittle and adds more maintenance cost than the workflow needs.

### Decision: Add dedicated recipe-share subscription events and scope them with `emitByPolicy`

Introduce recipe-share lifecycle subscription events in tRPC for create, update, revoke, and delete operations. Emit them with the existing `emitByPolicy` helper using the recipe view policy so clients only receive events they are allowed to observe.

Rationale: the repo already has policy-aware emit and subscription primitives for recipes, and share lifecycle changes should use the same audience model instead of inventing a second delivery rule.

Details:

- Event payloads should stay minimal and focus on invalidation, for example `recipeId`, `shareId`, lifecycle type, and a server timestamp/version marker if needed.
- Shared-react subscription hooks should invalidate the affected authenticated share queries, and can also invalidate related recipe detail queries if future share metadata is surfaced there.

Alternatives considered:

- Reuse `recipes.onUpdated` for share changes: rejected because a share lifecycle change is not a recipe content update and would blur cache responsibilities.
- Broadcast share events to all authenticated clients: rejected because it ignores the existing recipe visibility policy.

### Decision: Extend recipe detail context through adapters instead of inventing a UI-specific share store

Update `createRecipeDetailContext` to accept optional share adapters and expose share query/mutation state in the context value, while keeping the share hooks independently usable outside the detail context.

Rationale: recipe detail is the natural place for share management in future UI, and the repo already centralizes detail actions such as favorite, rating, nutrition, and conversions in that context. Adding share adapters follows the same pattern with minimal churn.

Alternatives considered:

- Create a new dedicated React context just for share management: rejected because it adds extra provider composition without a current need.
- Keep share hooks completely separate from all contexts: rejected because the user explicitly wants context updates and future UI would still need to re-wrap them.

### Decision: Include a public shared recipe query hook in the same shared-react capability

Expose a shared-react query hook for resolving the anonymous/public shared recipe contract by token, but keep it separate from authenticated share-management state.

Rationale: the share feature has two client consumers, authenticated management and public readonly consumption. Putting both in the same shared-react capability gives web and mobile a consistent contract without coupling anonymous flows into authenticated detail context.

Alternatives considered:

- Leave public shared recipe fetching out of scope: rejected because the proposal calls for shared hooks, not only authenticated mutations.

## Risks / Trade-offs

- [Share lifecycle events may trigger extra refetches in active clients] -> Mitigation: keep event payloads targeted by `recipeId` and invalidate only share-related query keys for the affected recipe.
- [Recipe detail context could grow harder to adopt if share fields are mandatory] -> Mitigation: add share adapters as optional extensions so existing consumers can migrate incrementally.
- [Backend and client subscription contracts could drift] -> Mitigation: define shared payload types in contracts and add focused shared-react/trpc tests around event handling.
- [No optimistic updates may make share creation feel slower in future UI] -> Mitigation: expose pending mutation state clearly so UI can show progress without pretending the share already exists.

## Migration Plan

1. Add recipe-share subscription contracts/events in tRPC using the existing policy-aware emitter pattern.
2. Add shared-react recipe-share query, mutation, cache-helper, and subscription hooks plus exports.
3. Extend `createRecipeHooks` and `createRecipeDetailContext` to surface the new shared-react share state.
4. Add tests for exports, detail-context wiring, and subscription-driven invalidation behavior.

Rollback strategy:

- Remove the new shared-react exports and recipe-share subscription hooks.
- Stop emitting the new share lifecycle events.
- Revert the optional recipe detail context share adapters without affecting existing recipe detail consumers.

## Open Questions

- None.
