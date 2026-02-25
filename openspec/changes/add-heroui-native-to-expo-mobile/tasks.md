## 1. Implementation

- [x] 1.1 Add `heroui-native` and mandatory peer dependencies in `apps/mobile/package.json`, then refresh the lockfile.
- [x] 1.2 Configure mobile styling/runtime wiring for HeroUI Native quick-start (`global.css` imports, Uniwind/Tailwind processing, and root provider composition with `GestureHandlerRootView`).
- [x] 1.3 Replace Expo starter template screens/components with a minimal Norish starter screen that renders HeroUI Native primitives using semantic classes (e.g., `bg-background`, `text-foreground`, `bg-primary`).
- [x] 1.4 Ensure mobile theme consumption is sourced from `@norish/tailwind-config/native-theme`, extending `tooling/tailwind/native-theme.css` only for missing HeroUI Native semantic token mappings.
- [x] 1.5 Remove obsolete Expo starter files/usages that are no longer referenced after the HeroUI Native starter is in place.

## 2. Validation

- [x] 2.1 Run `pnpm --filter @norish/mobile run lint` and resolve issues.
- [x] 2.2 Run `pnpm --filter @norish/mobile run typecheck` (or add the script if missing, then run it) and resolve issues.
- [x] 2.3 Start the app with `pnpm --filter @norish/mobile run start` and confirm HeroUI Native starter UI renders for native targets.
