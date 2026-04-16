## Context

Web keeps multiple `hooks/config` query hooks app-local even though the query pattern is reusable and mobile is starting to need the same config data. Mobile already uses shared tRPC provider infrastructure from `@norish/shared-react` but does not yet consume `@norish/i18n` or locale configuration for runtime language selection. The change spans `apps/web`, `apps/mobile`, and `packages/shared-react`, so we need a shared config-hook boundary that keeps app-specific router context while centralizing config query behavior.

## Goals / Non-Goals

**Goals:**

- Provide reusable config query hooks in `@norish/shared-react` that work with both web and mobile tRPC providers.
- Keep `config.localeConfig` as the single server source of truth for enabled locales and default locale.
- Enable mobile to load/apply translations from `@norish/i18n` and consume the same enabled locale list as web.
- Refactor web `hooks/config` query hooks to reuse shared implementations without behavior regression.

**Non-Goals:**

- Adding a new locale configuration endpoint or changing backend locale schema.
- Rewriting all existing web UI components that consume config hooks.
- Delivering full translated coverage for every mobile screen in this change (focus is wiring and integration path).

## Decisions

1. Create shared config query hook factories in `@norish/shared-react`.
   - Decision: Introduce hooks (or hook factories) in shared-react that encapsulate reusable `config.*` query behavior and defaults, including locale normalization logic (enabled locale codes, fallback default locale, name map).
   - Rationale: `useTRPC` is app-instantiated per provider bundle, so shared hooks should accept app-specific TRPC hooks/context while keeping query logic in one place.
   - Alternative considered: Duplicating equivalent hooks in mobile. Rejected because it recreates divergence and makes endpoint changes harder to roll out.

2. Keep platform-specific composition app-owned via thin wrappers.
   - Decision: Share config read hooks, but keep app-specific composition and side effects (for example user-context derived timers-enabled logic, cookies on web, native locale persistence/state on mobile) in app-level wrappers.
   - Rationale: persistence mechanisms differ across platforms and should remain close to platform auth/session storage.
   - Alternative considered: Fully shared end-to-end feature hooks. Rejected due to web/mobile context and state-management differences.

3. Wire mobile i18n through existing `@norish/i18n` config contracts.
   - Decision: Mobile imports locale validation/default helpers and message-loading surface from `@norish/i18n` so locale codes are validated consistently with web.
   - Rationale: avoids duplicating locale lists/types and guarantees message namespace compatibility across clients.
   - Alternative considered: Hardcoded mobile locale constants. Rejected because it can drift from server-enabled locale policy.

4. Migrate web `hooks/config` queries to shared-react with compatibility wrappers.
   - Decision: Replace internals of reusable web config hooks with shared implementations and preserve current return shapes used by existing components.
   - Rationale: minimizes risk, keeps imports stable, and enables incremental rollout.
   - Alternative considered: broad rename and API redesign of web hooks. Rejected to reduce churn.

## Risks / Trade-offs

- [Shared config hook API too coupled to one app] -> Mitigation: expose minimal typed inputs/outputs and avoid web-only concerns in shared-react.
- [Mobile translation loading impacts startup/render timing] -> Mitigation: use explicit loading state and fallback to default locale until messages are ready.
- [Behavior drift during multi-hook web refactor] -> Mitigation: keep wrapper contracts stable and migrate one hook at a time with focused tests.
- [Server-enabled locales omit currently selected locale] -> Mitigation: normalize to first enabled locale or server default locale fallback deterministically.

## Migration Plan

1. Add shared-react config query utilities/modules and export them.
2. Refactor reusable web config hooks to consume shared utilities with no outward API changes.
3. Add mobile locale integration hook(s) that consume shared locale config data plus `@norish/i18n` validation/loading.
4. Wire mobile language UI/state flow to use enabled locale list and apply locale changes.
5. Validate with platform-specific tests and smoke checks for web + mobile language switching and config consumption.

## Open Questions

- Should mobile persist selected locale through user preferences mutation, local storage fallback, or both when unauthenticated?
- Do we need a shared helper for locale display-name localization (currently server returns names) if mobile needs localized language labels?
