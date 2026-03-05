## Migration notes

- Shared permission/server-settings query factories now live in `packages/shared-react/src/hooks/permissions` and are bound per-app via local `useTRPC` wrappers.
- Web permission hooks now proxy through shared factories (`apps/web/hooks/permissions/shared-permissions-hooks.ts`) while preserving the existing `usePermissionsQuery` consumer shape.
- Mobile now has a dedicated permissions provider (`apps/mobile/src/context/permissions-context.tsx`) injected in the authenticated app tree before recipes consumers.
- Mobile AI controls are now hidden unless permissions/server settings are resolved and AI is enabled.
- Mobile delete controls are now hidden until permissions resolve and the user can delete the target recipe owner.
- Dashboard and search list screens now use native pull-to-refresh wired to recipe query invalidation with an overlap guard.

## Follow-up cleanup

- Evaluate whether remaining app-local wrappers in web/mobile should converge on a single shared context shape for permission-aware UI.
- Consider exposing a shared `useRefreshController` helper from `@norish/shared-react` if pull-to-refresh is added to additional screens.
- Add device-level manual QA coverage for permission transitions (role changes while screen is open) and refresh failure UX.
