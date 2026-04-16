## Context

Recipe filtering logic currently spans two separate context implementations and mobile relies on dummy filters that diverge from web behavior. In addition, mobile dashboard and search are not fully wired to shared/live recipe data, and loading feedback is inconsistent when pages load or new recipes appear. The change moves both contexts into `shared-react`, aligns mobile with the real filter model, wires mobile data surfaces to actual data streams, and removes web-only coupling that prevents safe reuse in mobile runtimes.

Constraints:

- Mobile and web must consume the same filter contract without introducing platform-specific forks.
- Existing consumers should migrate with low churn, ideally through compatibility exports/adapters.
- Shared package code must avoid dependencies that assume browser-only runtime behavior.

## Goals / Non-Goals

**Goals:**

- Establish a single source of truth for recipe contexts in `shared-react`.
- Define one cross-platform filter contract (state shape, option model, update semantics).
- Replace mobile dummy filters with shared, real filter definitions.
- Isolate React-bound wiring from platform-neutral domain logic to reduce hard dependency issues.
- Wire mobile dashboard and search screens to shared/actual recipe data sources, including live updates.
- Improve perceived performance with recipe card skeleton states during initial and incremental loading.

**Non-Goals:**

- Reworking recipe ranking/query business rules.
- Redesigning filter UI/visuals on web or mobile.
- Changing backend filter API semantics beyond required payload normalization.
- Introducing new animation frameworks beyond lightweight skeleton placeholders.

## Decisions

### Decision: Split domain contract from React integration

Create a platform-neutral module for filter schema, state transitions, and serialization; keep React context providers/hooks as thin wrappers around this domain layer.

Rationale: Mobile can reuse core behavior even where React integration constraints differ.

Alternatives considered:

- Keep current contexts and patch mobile mappings: rejected because drift will continue.
- Duplicate context logic per client: rejected due to maintenance overhead and inconsistent behavior.

### Decision: Move both recipe contexts to `shared-react` with compatibility exports

Relocate context source into `shared-react` and expose stable entrypoints. Keep short-lived compatibility re-exports in existing locations to reduce migration risk.

Rationale: Enables incremental consumer adoption and avoids broad, atomic refactors.

Alternatives considered:

- Big-bang import rewrite: rejected because it increases rollout risk.

### Decision: Canonical filter contract shared by web and mobile

Define required fields for each filter type, default values, and deterministic payload transformation. Mobile must use the same option set and keys as web.

Rationale: Prevents mismatched behavior and contract drift across clients.

Alternatives considered:

- Client-specific adapters only: rejected because contract differences remain hidden and brittle.

### Decision: Mobile dashboard and search consume shared live data hooks/selectors

Use shared context selectors/adapters to power recipe lists in mobile dashboard and search screens so both surfaces read from actual recipe data and live update pathways.

Rationale: Reduces stale state and duplicated fetching logic, while keeping behavior aligned with shared contract updates.

Alternatives considered:

- Keep existing page-local data wiring: rejected because it preserves drift and delays live update adoption.

### Decision: Standardize recipe skeleton loading states

Create `recipe-card-skeleton.tsx` under `components/skeletons` and use it for both initial page load and incremental "new recipe added" loading slots.

Rationale: Gives consistent, reusable loading UX and improves perceived responsiveness.

Alternatives considered:

- Spinner-only loading indicators: rejected because they provide less layout stability and weaker perceived performance.

## Risks / Trade-offs

- [Risk] Existing consumers rely on implicit behavior in legacy contexts -> Mitigation: provide compatibility exports and add focused regression tests for key flows.
- [Risk] React dependency extraction introduces temporary indirection -> Mitigation: keep adapter boundaries explicit and document ownership of domain vs UI integration.
- [Risk] Mobile filter UX may expose unsupported combinations once real filters are enabled -> Mitigation: validate contract against current backend-accepted payloads before rollout.
- [Risk] Live updates may introduce excessive re-renders on mobile list screens -> Mitigation: use memoized selectors and batched update handling.
- [Risk] Skeleton states could flicker during fast network transitions -> Mitigation: apply minimum-display thresholds and conditional placeholder counts.

## Migration Plan

1. Introduce shared domain contract and context wrappers in `shared-react`.
2. Add compatibility exports from previous module paths.
3. Migrate web and mobile consumers to new shared entrypoints.
4. Replace mobile dummy filter config with shared definitions.
5. Wire mobile dashboard and search recipe lists to shared/actual data flows with live updates.
6. Add `recipe-card-skeleton.tsx` and integrate skeleton rendering for initial and incremental loading states.
7. Run cross-platform regression checks for filter state, request payload parity, and mobile live-update/skeleton behavior.
8. Remove compatibility exports after adoption window.

Rollback: restore previous import paths, revert mobile dashboard/search to prior data wiring, and disable skeleton integration while retaining new code behind unused exports.

## Open Questions

- Should compatibility exports remain for one release or longer based on app release cadence?
- Do any mobile-only filters need explicit exclusion rules, or should all shared filters be available by default?
- What is the expected debounce/coalescing behavior for rapid live recipe updates on dashboard/search?
