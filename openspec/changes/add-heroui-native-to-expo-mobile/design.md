## Context

`apps/mobile` exists as an Expo Router app, but it still uses Expo template navigation and themed wrappers rather than HeroUI Native primitives. The repository already has shared web theme tokens under `tooling/tailwind/theme.css` and a `native-theme` export intended for native token mapping. This change needs to wire HeroUI Native into the app runtime and ensure mobile UI tokens remain sourced from shared tooling, not duplicated app-local colors.

## Goals / Non-Goals

- Goals:
  - Enable HeroUI Native provider and component usage in `apps/mobile`.
  - Ensure mobile theme values come from `@norish/tailwind-config/native-theme` (backed by existing Hero tokens).
  - Replace Expo starter content with a minimal Norish starter screen built from HeroUI Native components.
  - Keep implementation aligned with HeroUI Native quick-start compatibility guidance.
- Non-Goals:
  - Building full product feature screens for mobile.
  - Defining a new mobile-only theme palette separate from `tooling/tailwind`.
  - Achieving parity for HeroUI Native on Expo web (upstream docs currently discourage web usage).

## Decisions

- Decision: Use the standard `HeroUINativeProvider` wrapped by `GestureHandlerRootView` at the app root.
  - Why: This matches upstream integration requirements and guarantees HeroUI Native components have required context.
- Decision: Keep `tooling/tailwind/theme.css` as source-of-truth and import `@norish/tailwind-config/native-theme` from mobile global CSS.
  - Why: Prevents token drift between web and mobile and matches monorepo shared-config conventions.
- Decision: Use HeroUI Native quick-start dependency versions (or compatible patch/minor equivalents) for mandatory peers.
  - Why: Reduces integration risk from known version mismatches in React Native ecosystems.
- Decision: Prefer granular HeroUI Native imports for starter screens where practical.
  - Why: Supports bundle-size discipline while still allowing a straightforward migration path.

## Alternatives Considered

- Keep Expo starter UI and only add provider wiring.
  - Rejected: does not prove component-level integration or token usage.
- Define theme tokens directly in `apps/mobile`.
  - Rejected: duplicates design system and violates shared theme ownership.
- Use `HeroUINativeProviderRaw` instead of the default provider.
  - Deferred: possible optimization later, but default provider keeps initial integration simpler and fully featured.

## Risks / Trade-offs

- React Native dependency conflicts may occur if peer versions drift from Expo SDK recommendations.
  - Mitigation: capture version expectations in tasks and verify app startup after install.
- HeroUI Native has limited web guidance for Expo web.
  - Mitigation: scope acceptance to native targets (iOS/Android) and avoid requiring web parity in this change.

## Migration Plan

1. Update mobile dependencies and style pipeline.
2. Wire root provider and global CSS imports.
3. Replace template starter UI with HeroUI Native-based Norish starter content.
4. Validate lint/type checks and app boot for mobile targets.

## Open Questions

- None for this proposal; implementation can proceed with iOS/Android as primary supported targets.
