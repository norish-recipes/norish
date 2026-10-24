# 39 — Hooks rules from one ESLint plugin

Status: resolved
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md` decision 10, ticket 12. Found in the branch review on 2026-10-13.

## What to build

`tooling/eslint/react.ts:40` switches off five `@eslint-react` rules, because eslint-plugin-react-hooks "owns the hooks rules".

@eslint-react 5.26 is built to replace eslint-plugin-react-hooks, not to sit beside it:

- It carries its own version of every react-hooks rule: `rules-of-hooks`, `exhaustive-deps`, `refs`, `immutability`, `purity`, `set-state-in-effect`, `set-state-in-render`, `globals`, `static-components`, `use-memo`, `error-boundaries` and `unsupported-syntax`.
- It ships a `disable-conflict-eslint-plugin-react-hooks` preset for projects that still have both plugins.

Today two plugins check the same things, and one set is switched off by hand.

**The fix:**

1. Drop eslint-plugin-react-hooks.
2. Carry its deliberate choices over to the @eslint-react rule names: `exhaustive-deps` as a warning; `refs`, `set-state-in-effect` and `immutability` off.
3. `incompatible-library` and `preserve-manual-memoization` are React Compiler rules with no @eslint-react counterpart. They are off today, so nothing is lost, and they stay gone: eslint-plugin-react-hooks does not come back, not even for `.scratch/architecture-after-upgrades/` ticket 10.
4. `exhaustive-deps` warnings then report as `@eslint-react/exhaustive-deps` (2 in apps/web on 2026-10-14). Ticket 47 fixes them with the other @eslint-react warnings.

## Acceptance criteria

- [x] `tooling/eslint` no longer depends on eslint-plugin-react-hooks, and no rule is switched off for being a duplicate.
- [x] `pnpm lint` reports no new errors, and the warning count does not grow.

## Comments

- Filed 2026-10-13 from the branch review.
- 2026-10-14 — The maintainer confirmed: remove eslint-plugin-react-hooks for good, with no later re-add for the two compiler-only rules. Lands before 47.
- 2026-10-14 (implemented) — eslint-plugin-react-hooks is gone from `tooling/eslint` and the lockfile. The `recommended-typescript` preset already has `exhaustive-deps` as a warning and leaves `refs` and `immutability` off, so the only override left is `set-state-in-effect: off`. The six `eslint-disable` comments and the E2E `rules-of-hooks` override now name `@eslint-react`.
  - @eslint-react's `purity` is stricter than react-hooks' compiler-based one and found three render-time clock reads: the calendar's initial date became a lazy initial state, and the join-code card (re-rendered every second by its countdown) and the landing footer (a server component) carry a disable with the reason. Its `globals` is not in the preset, so it is off; react-hooks' version had reported nothing.
  - Lint, errors/warnings: apps/web 0/599 → 0/598 (the calendar's lazy state removed one `use-state` warning), apps/landing 0/15 → 0/15, shared-react 0/2 and ui 0/0 unchanged.
