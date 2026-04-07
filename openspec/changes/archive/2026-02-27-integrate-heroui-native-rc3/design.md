## Context

The mobile app is an Expo starter that currently renders a custom start card without using a shared component library. The repository already has Tailwind-native theme tokens at `tooling/tailwind/native-theme.js`, but there is no standardized UI component abstraction consuming those tokens in mobile screens. This change introduces HeroUI Native RC3 as the primary component layer for mobile UI composition and uses the start card replacement as the first integration slice.

## Goals / Non-Goals

**Goals:**

- Add HeroUI Native RC3 to the mobile app and configure provider/bootstrap requirements.
- Ensure HeroUI components can consume the existing native Tailwind theme tokens instead of creating a competing theme source.
- Replace the current start screen card with HeroUI `Card` while preserving existing user-facing behavior.
- Establish a repeatable migration pattern for additional screen components.

**Non-Goals:**

- Full-screen or app-wide UI migration to HeroUI in this change.
- Redesigning feature flows, copy, or navigation structure on the start screen.
- Replacing the existing Tailwind theme token file or introducing a new design token system.

## Decisions

1. Use HeroUI Native RC3 as the component dependency target.
   - Rationale: RC3 is the latest candidate and provides stable APIs needed for immediate migration work.
   - Alternative considered: waiting for a later release; rejected to avoid blocking UI standardization work.

2. Integrate through app-level provider wiring in the Expo entry/root layout before screen-level adoption.
   - Rationale: central provider setup avoids per-screen glue code and keeps theme/runtime behavior consistent.
   - Alternative considered: local screen-only wrapper; rejected because it creates inconsistent behavior and harder rollout.

3. Treat `tooling/tailwind/native-theme.js` as the canonical token source and map HeroUI theme usage to it.
   - Rationale: preserves existing theme investment and avoids token drift.
   - Alternative considered: generate a separate HeroUI theme map manually; rejected due to duplication risk.

4. Start migration with the start card only.
   - Rationale: small, testable slice that validates dependency, provider, and theme integration together.
   - Alternative considered: migrate multiple screens in one pass; rejected to reduce rollout risk.

## Risks / Trade-offs

- [Package compatibility drift between Expo and RC3 peers] -> Mitigation: pin compatible versions and verify with install + typecheck/start command.
- [Theme mismatch between HeroUI defaults and existing native-theme tokens] -> Mitigation: explicitly map token usage and validate visual parity on start card states.
- [Unexpected layout changes from replacing custom card markup] -> Mitigation: preserve spacing/content hierarchy and run quick device-size verification for phone breakpoints.
- [Partial adoption complexity] -> Mitigation: document migration pattern and keep card conversion isolated with clear boundaries.

## Migration Plan

1. Add HeroUI Native RC3 and required peer packages to the mobile workspace.
2. Wire HeroUI provider/theme integration in app root using existing token source from `tooling/tailwind/native-theme.js`.
3. Replace start screen card implementation with HeroUI `Card`, preserving behavior and content.
4. Verify app startup, start screen rendering, and style consistency on at least one iOS and one Android simulator profile.
5. Document migration notes for future screen/component conversions.

Rollback strategy: revert provider wiring and card replacement commits, then remove HeroUI dependencies if runtime regressions are discovered.

## Open Questions

- Whether any RC3 package naming changed from prior beta docs and requires import-path adjustments in this repo.
- Whether the current start card uses custom interactions that should be mapped to specific HeroUI subcomponents (header/body/footer) vs a single card container.
