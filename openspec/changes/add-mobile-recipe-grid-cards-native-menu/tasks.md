# Tasks: Add mobile recipe dashboard cards and native menu

## 1. Mobile Recipe Card Grid

- [ ] 1.1 Create a `recipe-dashboard` component area in `apps/mobile/components/` for card-grid UI.
- [ ] 1.2 Implement a reusable mobile recipe card component that mirrors the web dashboard card information hierarchy.
- [ ] 1.3 Implement a mobile dashboard grid container that lays cards out responsively for common phone widths.
- [ ] 1.4 Replace the current `apps/mobile/app/index.tsx` showcase body with the new recipe card grid screen using sample card data.

## 2. Native Menu Actions

- [ ] 2.1 Define a basic card action set and menu trigger pattern suitable for touch (e.g., overflow button).
- [ ] 2.2 Implement a per-card menu using a platform-native menu surface (no custom themed dropdown styling).
- [ ] 2.3 Wire menu actions to placeholder handlers/navigation stubs so interactions are demonstrable end-to-end.

## 3. Validation

- [ ] 3.1 Run `pnpm --filter @norish/mobile run lint` and fix any lint issues.
- [ ] 3.2 Run `pnpm --filter @norish/mobile run typecheck` and fix any type errors.
- [ ] 3.3 Run `pnpm --filter @norish/mobile run start` and verify the recipe grid and native menu render/behave on device or simulator.
