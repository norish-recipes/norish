# 48 — tRPC's typecheck without rewriting dist

Status: resolved
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`, ticket 25. Found in the branch review on 2026-10-13.

## What to build

Ticket 25 says: "trpc keeps a separate script for its dist refresh." It didn't happen:

- `packages/trpc/package.json`'s `typecheck` is still `rm -rf dist .cache && tsc -p tsconfig.json`, so a type check deletes and re-emits `dist`.
- The emit is deliberate. Dependent workspaces read tRPC's types through `dist/`, about 33% cheaper than through source, and turbo's `typecheck` runs `^typecheck` first, so that run is what keeps `dist` fresh.

**The fix:**

1. Make `typecheck` a pure check (`tsc --noEmit`).
2. Leave the dist refresh to `build`, which already exists.
3. Make the dependents' `typecheck` depend on `@norish/trpc#build` in turbo, rather than on tRPC's type check.

## Acceptance criteria

- [x] tRPC's `typecheck` writes nothing.
- [x] `pnpm typecheck` from a clean checkout (no `dist`) passes.
- [x] Its wall time is recorded before and after, and is no worse.

## Comments

- Filed 2026-10-13 from the branch review.
- 2026-10-14 (implemented) — `@norish/trpc`'s `typecheck` is `tsc --noEmit` and leaves no `dist` behind. In `turbo.json` the typecheck of the three workspaces that read tRPC's types through `dist` (`@norish/api`, `@norish/shared-react`, `@norish/web`) depends on `@norish/trpc#build`, and the generic `typecheck` no longer lists `dist/**` as an output.
  - `@norish/trpc#build` has its own entry without `^build`: its declaration emit (`--noCheck`) reads its dependencies' types from their source, so waiting for their builds only added eight package builds to every typecheck. With `^build` the typecheck took 33 s and 31 s; without it, 29, 28 and 28 s.
  - Wall time of `turbo run typecheck --force` from a checkout with no `packages/trpc/dist`, three runs each on an idle machine: before 31, 29, 29 s (19 tasks); after 29, 28, 28 s (20 tasks). Both pass.
- 2026-10-14 (review fixes) — The entries moved from the root `turbo.json` into the package configurations (`packages/trpc`, `packages/api`, `packages/shared-react`, `apps/web`), which append `@norish/trpc#build` to the inherited `dependsOn`; `turbo run typecheck --dry` shows the same graph. tRPC's `typecheck` and `build` ran unordered and shared `.cache/tsbuildinfo.json`: the typecheck now keeps its own (`.cache/typecheck.tsbuildinfo.json`) and the build deletes only its own file, so neither touches the other's. The typecheck still writes nothing to `dist`.
