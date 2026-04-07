## Context

Web already has a permissions/server-settings contract through `permissions-context` and a web-local tRPC hook, while mobile currently renders AI/delete affordances without the same shared contract boundary. The repo already uses `@norish/shared-react` hook factories for shared config queries, so extending that pattern for permissions/settings keeps platform boundaries consistent. Mobile also needs user-initiated refresh on core feed/list surfaces.

## Goals / Non-Goals

**Goals:**

- Define one shared, typed permissions/server-settings hook contract in `@norish/shared-react` consumable by both web and mobile.
- Ensure mobile UI gates AI and delete actions from resolved permission/settings state, preventing unavailable actions from being shown.
- Add pull-to-refresh on primary Norish mobile list/feed surfaces with consistent loading and refetch behavior.
- Preserve existing app-owned tRPC injection pattern so shared packages do not import app-local provider code.

**Non-Goals:**

- Redesigning mobile recipe/list visual layouts beyond refresh affordance and action gating.
- Changing backend permission semantics or adding new permission types.
- Replacing all existing app wrappers; wrappers remain where app-specific composition is required.

## Decisions

- Create shared permission hook factories in `@norish/shared-react` rather than directly sharing web context modules.
  - Rationale: aligns with existing shared-config-hooks architecture and avoids cross-app imports.
  - Alternative considered: import web `permissions-context` into mobile; rejected because it violates package boundaries and couples mobile to web runtime assumptions.

- Keep a small app wrapper layer in web/mobile that binds app-owned `useTRPC` and exposes convenience selectors.
  - Rationale: preserves platform-specific composition while centralizing query contracts.
  - Alternative considered: fully shared top-level context provider; rejected because provider setup differs between app shells.

- Gate mobile AI/delete affordances at render time from resolved permission/settings state and treat unknown/loading conservatively.
  - Rationale: safest default is to avoid showing restricted actions before eligibility is known.
  - Alternative considered: optimistically show actions then disable after fetch; rejected due to flicker and accidental affordance exposure.

- Implement pull-to-refresh using platform-native refresh controls tied to query invalidation/refetch for the relevant mobile screens.
  - Rationale: native refresh gesture matches user expectation and avoids bespoke gesture handling.
  - Alternative considered: custom swipe gesture; rejected due to complexity and inconsistent behavior.

## Risks / Trade-offs

- [Risk] Divergent data shape expectations between web and mobile consumers -> Mitigation: define normalized shared return types and keep app wrappers for mapping.
- [Risk] Over-fetching/refetch storms when pull-to-refresh triggers multiple queries -> Mitigation: centralize refresh orchestration per screen and debounce repeated gestures while refresh is active.
- [Risk] Hidden actions could reduce discoverability for users who recently gained permissions -> Mitigation: ensure refresh/state updates invalidate relevant queries so visibility updates quickly.

## Migration Plan

1. Introduce shared-react permissions/settings hook factories with tests.
2. Update web permission hook/context to consume shared factories while preserving existing public web interfaces.
3. Add mobile wrappers and integrate gating in AI/delete action surfaces.
4. Add pull-to-refresh wiring to primary mobile list/feed screens and connect to refetch orchestration.
5. Validate parity via targeted tests and manual QA on mobile and web.

Rollback strategy: revert app wrappers to existing local hooks and remove shared factory usage if regressions occur.

## Open Questions

- Which specific mobile screens are in scope for initial pull-to-refresh (home feed only vs. additional list screens)?
- Should unauthorized delete actions be fully hidden everywhere, or hidden in lists and still shown as disabled in some detail views?
