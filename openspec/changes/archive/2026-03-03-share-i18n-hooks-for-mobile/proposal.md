## Why

Mobile currently does not consume the shared i18n package or the server-driven enabled locale list, and web keeps config query hooks in an app-local directory. We should align both clients on shared config hooks now so mobile can ship translated UI with the same source of truth and we avoid duplicating hook logic as mobile adopts more config endpoints.

## What Changes

- Move the reusable `apps/web/hooks/config` tRPC query hooks into `@norish/shared-react` as shared config hooks with injected `useTRPC` bindings.
- Keep thin app-level wrappers in web and mobile so platform-specific behavior can stay local while query logic is shared.
- Share locale configuration query/normalization through the new shared config hook module.
- Wire mobile to `@norish/i18n` for message loading and locale validation using the same enabled locale data contract used on web.
- Add mobile integration points for selecting and applying a locale based on enabled server locales.

## Capabilities

### New Capabilities

- `mobile-i18n-integration`: Mobile can load translations from `@norish/i18n`, validate locale selection, and apply server-enabled locale choices.
- `shared-config-hooks`: Shared React hooks expose reusable config query behavior (including locale config) for both web and mobile clients.

### Modified Capabilities

- `mobile-ui`: Language selection surfaces use server-enabled locales and display translated labels when mobile i18n is active.

## Impact

- Affected code: `apps/mobile`, `apps/web/hooks/config`, and `packages/shared-react` hooks exports.
- APIs: Reuses existing `config.localeConfig` tRPC endpoint; no new endpoint required.
- Dependencies: Mobile adds usage of `@norish/i18n` runtime helpers and message loading paths.
- Behavior: Locale availability and switching logic become consistent across web and mobile.
