# Change: Add Community Theme System

## Why

Enable community members to create and share custom themes without forking the codebase. Admins can link to external CSS repositories to customize the app's appearance while maintaining full light/dark mode support. This unlocks customization without requiring updates to the core app.

## What Changes

- Admin settings now include a **Theme Configuration** card where server admins can paste an external CSS repository URL
- The app automatically loads and injects the external CSS, which can override all color tokens and styles
- Community members can create reusable theme packages and share URLs for the community to use
- Users retain dark/light/system mode selection—themes layer on top of this choice

## Impact

**Affected specs:** appearance (new)

**Affected code:**
- `server/db/zodSchemas/server-config.ts` - Add theme config schema
- `app/(app)/settings/admin/` - New theme config card component
- `app/layout.tsx` or `app/providers.tsx` - CSS injection logic
- Example theme repository (separate or docs)

**Breaking changes:** None

## Related Decision

- Theme CSS must support both light and dark modes via CSS variables
- External CSS is loaded at runtime, no build step required
- URL validation and CSP headers protect against malicious CSS injection
