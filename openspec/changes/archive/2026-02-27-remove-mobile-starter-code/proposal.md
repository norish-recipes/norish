## Why

The mobile app still contains Expo starter-template surfaces and helper abstractions that are no longer aligned with the product direction. Removing this starter code now reduces maintenance overhead, prevents accidental reuse of demo patterns, and makes the app shell easier to evolve.

## What Changes

- Remove the starter `explore` route and any tab/navigation wiring that exists only to support template walkthrough content.
- Remove template-only UI primitives and theme helpers from `src/components`, `src/constants/theme.ts`, and `src/hooks` when they are not required by current product features.
- Keep and rewire only the minimal shared pieces needed by active screens (for example, home recipe cards and required app providers).
- Update imports and screen composition so the mobile app builds and runs without references to deleted starter files.

## Capabilities

### New Capabilities

- `mobile-app-shell-cleanup`: Defines the expected post-template mobile shell with starter screens/components removed and active features still functional.

### Modified Capabilities

- `mobile-ui`: Replace the starter-screen-specific requirement with requirements for a production-oriented mobile shell that excludes template walkthrough UI.

## Impact

- Affected code: `apps/mobile/src/app`, `apps/mobile/src/components`, `apps/mobile/src/constants/theme.ts`, `apps/mobile/src/hooks`, and related asset/import references.
- Behavior impact: mobile navigation surface and shared UI composition become product-focused instead of template-focused.
- No backend/API contract changes are expected.
