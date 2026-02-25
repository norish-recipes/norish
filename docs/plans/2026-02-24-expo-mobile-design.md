# Expo Mobile App Design (Norish)

## Goal

Add a basic Expo app to the Norish monorepo at `apps/mobile` with a starter screen that uses HeroUI Native components and the Norish theme.

## Decisions

### 1) Architecture

- Use `apps/mobile` with Expo Router and TypeScript.
- Keep theme source-of-truth in monorepo tooling, following the same shared-config spirit as create-t3-turbo.
- Use `Uniwind` (not NativeWind) for styling performance and HeroUI Native compatibility.
- Use HeroUI Native provider setup (`GestureHandlerRootView` + `HeroUINativeProvider`) at the app root.

### 2) Monorepo + Theme Strategy

- Reuse existing theme tokens from `tooling/tailwind/theme.css`.
- Add a native-focused adapter export in tooling so mobile imports shared Norish tokens from workspace package(s), instead of duplicating colors.
- Keep web theme tokens unchanged; native adapter only fills gaps required by HeroUI Native semantics.

### 3) Starter UI

- Build `apps/mobile/app/index.tsx` as a basic starter page.
- Include a HeroUI Native card-like block, primary action, and a light/dark theme toggle.
- Use semantic classes (`bg-background`, `text-foreground`, `bg-primary`, etc.) to prove theme wiring.

### 4) Inspiration from create-t3-turbo

Use the same structural ideas:

- Shared `tooling/tailwind` package for theme/postcss exports.
- App-local Expo config files (`metro.config`, `postcss.config`, app scripts).
- App style entry that imports monorepo theme package.

But adapt stack choices:

- Keep Expo Router.
- Replace NativeWind usage with Uniwind.
- Add HeroUI Native integration requirements.

## Error Handling

- Pin HeroUI Native peer dependency versions to recommended docs versions to avoid runtime mismatch.
- If style pipeline fails, ensure app still boots with minimal RN fallback while CSS integration is corrected.
- Avoid destructive theme edits; preserve existing web palette and behavior.

## Verification

- Install workspace dependencies successfully from root.
- Start Expo app via workspace filter.
- Confirm starter screen renders and theme toggles.
- Run typecheck/lint on touched packages to guard regressions.

## Success Criteria

- `apps/mobile` exists and boots.
- HeroUI Native components render on the starter page.
- Norish light/dark tokens are active in mobile.
- Shared monorepo tooling remains the theme source of truth.
