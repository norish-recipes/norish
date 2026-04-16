## Why

Mobile currently lacks the same permission and server-setting awareness used on web, which can expose AI and delete actions when they should be unavailable. Aligning these contracts now prevents inconsistent behavior and enables predictable feature gating across clients.

## What Changes

- Move shared permission/server-settings query contract from web-local hooks into `@norish/shared-react` so both web and mobile consume the same typed hook API.
- Add mobile wiring for permission-aware UI gating so AI controls are hidden when AI is disabled and delete actions are hidden/disabled when delete permission is not granted.
- Add pull-to-refresh support on Norish mobile list/feed surfaces so users can manually refresh data.
- Keep app-specific composition in thin app wrappers while centralizing reusable query behavior in shared-react.

## Capabilities

### New Capabilities

- `mobile-pull-to-refresh`: Defines pull-to-refresh behavior, refresh state UX, and data revalidation expectations for primary mobile recipe/feed surfaces.

### Modified Capabilities

- `shared-config-hooks`: Expand shared hook contract to include permission/server-settings query primitives consumable by both web and mobile.
- `mobile-ui`: Require permission-driven visibility for AI/delete controls in mobile surfaces that expose those actions.

## Impact

- Affected code: `apps/web/context/permissions-context.tsx`, `apps/web/hooks/permissions/use-permissions-query.ts`, mobile action surfaces, and shared-react hook modules/factories.
- API/data contracts: typed tRPC query hook surface for permissions/server settings becomes shared and app-injected.
- UX impact: mobile users see only actions they are allowed to use; users can manually refresh content with pull-to-refresh.
- Test impact: shared hook unit coverage plus mobile UI behavior tests for gated actions and refresh interactions.
