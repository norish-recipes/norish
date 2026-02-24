# Change: Extract shareable hooks and contexts for cross-platform reuse

## Why

Norish now runs in a monorepo, and many React hooks/contexts can be reused across web and a planned React Native app. Today, these modules are mostly anchored in `apps/web`, making reuse hard and obscuring which modules are web-only.

## What Changes

- Define a formal shareability classification for hooks and contexts (runtime-safe, adapter-required, web-only).
- Extract eligible hooks/contexts from `apps/web` into shared package surfaces now, with compatibility requirements for both web and React Native consumers.
- Require explicit platform adapters for browser/navigation/auth side-effects so shared logic remains runtime-agnostic.
- Require a maintained inventory of hooks/contexts that cannot be moved to shared, with reason and migration trigger.
- Update monorepo folder placement rules so `context`/`hooks` are no longer forced to remain only under `apps/web`.

## Impact

- Affected specs: `monorepo-folder-placement`, `dependency-boundaries`, `shared-hooks-contexts` (new)
- Affected code: `apps/web/context/**`, `apps/web/hooks/**`, `packages/shared/**` (and/or a dedicated shared React package), lint/validation rules, migration docs
