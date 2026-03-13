## 1. Route and shell cleanup

- [x] 1.1 Remove `apps/mobile/src/app/explore.tsx` and any route exports that reference the starter explore screen.
- [x] 1.2 Update `apps/mobile/src/components/app-tabs.tsx` and `apps/mobile/src/components/app-tabs.web.tsx` to remove the explore tab and starter/doc-link UI.
- [x] 1.3 Update `apps/mobile/src/app/_layout.tsx` to keep only app-shell providers/components that are still required after starter cleanup.

## 2. Shared starter module removal

- [x] 2.1 Audit `apps/mobile/src/components` and delete starter-only modules (for example `external-link`, `web-badge`, `ui/collapsible`, unused animation assets) that are no longer imported.
- [x] 2.2 Audit `apps/mobile/src/constants/theme.ts` and `apps/mobile/src/hooks/*` and remove starter-only theme or color-scheme helpers that are no longer used by active screens.
- [x] 2.3 Refactor remaining screens (home and feature components) to use retained primitives after wrapper/helper removals.

## 3. Validation and hardening

- [x] 3.1 Run mobile lint/typecheck (or the repo-standard mobile validation commands) and resolve all import/route errors introduced by cleanup.
- [x] 3.2 Run a final unused-import/dead-file sweep in `apps/mobile/src` and remove leftover starter references.
- [x] 3.3 Smoke test the home screen on native and web targets to confirm recipe list rendering and swipe interactions still work.
