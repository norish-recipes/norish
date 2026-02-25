# Design: Mobile recipe dashboard cards and native menu

## Context

The web app already has mature recipe dashboard cards in `apps/web/components/dashboard/recipe-card.tsx` and a virtualized grid in `apps/web/components/dashboard/recipe-grid.tsx`. The Expo mobile package currently renders a HeroUI Native theme showcase in `apps/mobile/app/index.tsx` and has no recipe dashboard card system yet.

The requested change is to recreate the same card experience in the mobile package and pair it with a basic menu that uses native device styling.

## Goals / Non-Goals

- Goals:
  - Deliver a mobile dashboard-style recipe card grid with familiar card hierarchy and look.
  - Provide a simple per-card menu that appears as a native platform menu surface.
  - Keep the first version minimal and demonstrable in the existing mobile entry route.
- Non-Goals:
  - Full feature parity with all web-card interactions (swipe actions, permissions, optimistic server mutations).
  - Full recipe backend/query integration in this change.
  - Redesigning the existing shared token/theme system.

## Decisions

- Decision: Create dedicated mobile dashboard components under `apps/mobile/components/recipe-dashboard/` instead of expanding `app/index.tsx` inline.
  - Rationale: keeps future mobile recipe work composable and testable.
- Decision: Mirror the web card information hierarchy, not web-only interaction complexity.
  - Rationale: satisfies "same grid cards" visual/structural intent while keeping implementation scope small.
- Decision: Use a native menu API/component for per-card actions.
  - Rationale: satisfies "device native menu styling" explicitly and avoids custom dropdown recreation in React Native.

## Risks / Trade-offs

- Native menu behavior can differ between iOS and Android.
  - Mitigation: specify a shared minimum action contract and test both platform presentations.
- Visual parity with web cards may drift if web card details evolve.
  - Mitigation: keep the mobile card props aligned with core recipe dashboard fields and document parity expectations in spec scenarios.
- Limiting scope to UI-only means no live data on first pass.
  - Mitigation: use realistic sample data and keep component APIs ready for later data-source wiring.

## Migration Plan

1. Add mobile dashboard card and grid components.
2. Replace starter route content with the new grid using sample data.
3. Add native menu trigger and actions per card.
4. Validate lint/typecheck/startup and confirm behavior on simulator/device.

## Open Questions

- None required for this proposal stage; implementation can proceed with UI-first scope and follow-up proposals can extend to live recipe data integration.
