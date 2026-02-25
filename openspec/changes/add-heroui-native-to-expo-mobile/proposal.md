# Change: Integrate HeroUI Native into Expo mobile app

## Why

The current `apps/mobile` project is still the default Expo starter and does not use Norish's shared Hero theme tokens or HeroUI Native components. Integrating HeroUI Native with shared `tooling/tailwind` theme assets creates a consistent design system across web and mobile while establishing a production-ready base for future mobile screens.

## What Changes

- Add HeroUI Native and required peer dependencies to `@norish/mobile`.
- Configure mobile styling pipeline for Uniwind + HeroUI Native styles and ensure app root provider setup is correct.
- Rework the starter screen to use HeroUI Native components and semantic theme classes instead of Expo starter UI.
- Reuse existing theme tokens from `tooling/tailwind` via the existing native theme export, extending that adapter only where HeroUI Native semantic tokens require it.
- Define validation expectations for mobile startup and workspace-level lint/type checks.

## Impact

- Affected specs: `mobile-ui`
- Affected code: `apps/mobile/*`, `tooling/tailwind/*`, workspace dependency manifests and lockfile
