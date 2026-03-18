## 1. Shared Config Hook Foundation

- [x] 1.1 Add shared config query modules/types in `packages/shared-react` for reusable `config.*` procedures.
- [x] 1.2 Implement a shared hook factory/binding pattern that injects app-owned `useTRPC`.
- [x] 1.3 Port locale config query + normalization into the shared config module and export it.
- [x] 1.4 Port additional reusable web `hooks/config` query logic into shared-react (tags, units, recurrence config, timer keywords, upload limits, timers enabled base query as applicable).

## 2. Web Config Wrapper Migration

- [x] 2.1 Refactor each reusable hook in `apps/web/hooks/config` to become a thin wrapper over shared-react config hooks while preserving current return shapes.
- [x] 2.2 Keep app-specific composition (`use-timers-enabled-query`, and any non-tRPC/web-only behavior) in web wrappers.
- [x] 2.3 Update `apps/web/hooks/config/index.ts` exports/imports impacted by the refactor.
- [x] 2.4 Add or update web tests for migrated config hooks, including locale mapping and default fallback behavior.

## 3. Mobile i18n Wiring and Locale Selection

- [x] 3.1 Add mobile i18n integration utilities/hooks that use `@norish/i18n` locale validation/default behavior and message loading.
- [x] 3.2 Add a mobile wrapper hook for locale config using the shared config hook binding.
- [x] 3.3 Integrate shared locale config data into mobile language selection state so only enabled locales are selectable.
- [x] 3.4 Update mobile language selector UI text to use translation keys and fallback behavior.

## 4. Validation and Rollout Safety

- [x] 4.1 Add or update mobile tests for locale fallback, enabled locale filtering, and selector rendering.
- [x] 4.2 Run targeted checks for shared-react config hooks plus web/mobile consumers and fix any type/runtime issues.
- [x] 4.3 Perform manual smoke verification of language switching in both web and mobile against the same backend locale configuration.
