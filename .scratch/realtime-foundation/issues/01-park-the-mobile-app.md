# 01 — Park the mobile app

**What to build:** Take `apps/mobile` out of the root gates so the realtime rebuild can delete what it depends on without maintaining it. The Expo app needs a rewrite of its own and gets a separate plan; until then it is parked: present in the repo, startable with `pnpm dev:mobile`, but not linted, typechecked or tested by `pnpm lint`, `pnpm typecheck` or `pnpm test:run`, and expected to break at compile and runtime against this release. Turbo runs a task only in packages that define the script, so parking is removing scripts, not adding filters.

**Blocked by:** none — can start immediately.

**Spec:** `.scratch/realtime-foundation/spec.md`

**Status:** ready-for-human

- [x] `apps/mobile/package.json` no longer defines `lint`, `typecheck` or `test`; `start` stays so `pnpm dev:mobile` works
- [x] The root `typecheck:mobile` script in `package.json` is removed
- [x] `AGENTS.md` (Repo Shape, the `apps/mobile` line) and `CONTRIBUTING.md` (the workspace table) say the app is parked pending a rewrite and not covered by the gates
- [x] Nothing else under `apps/mobile` changes
- [x] `pnpm lint`, `pnpm typecheck` and `pnpm test:run` run nothing in `apps/mobile` (check turbo's task list in the output)
- [x] `pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build` green

## Comments

- Implemented on `claude/realtime-foundation-scratch-enjqqw`. `turbo run lint|typecheck|test --dry-run=json` reports `<NONEXISTENT>` for `@norish/mobile` on all three tasks; the root `typecheck:mobile` script is gone. `pnpm dev:mobile` still resolves to `expo start`.
