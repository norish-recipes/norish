# 12 — ESLint 10

Status: resolved
Blocked by: 11 (typescript-eslint latest)
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

Move `eslint` from 9.39.5 to **10.12.0** and `@eslint/js` to **10.0.1**. npm marks 9.39.5 "no longer supported".

Changes that touch Norish, from ESLint's v10 migration guide and the 10.12.0 tarball:

- **Rule-context members were removed:** `context.getFilename`, `getSourceCode`, `getCwd`, `getPhysicalFilename`, `parserOptions` and `parserPath`.
  - **eslint-plugin-react 7.37.5 crashes.** It calls `context.getFilename()` whenever `settings.react.version` is `"detect"`, which `tooling/eslint/react.ts` sets. Its peer range stops at `^9.7`, and it hasn't been released since 2025-04-03.
  - **eslint-plugin-jsx-a11y 6.10.2** stops at `^9`, and **eslint-plugin-import 2.32.0** at `^9`.

**Decision (2026-10-13): replace them with maintained plugins** rather than wrapping them in `fixupPluginRules`.

- **eslint-plugin-react → `@eslint-react/eslint-plugin`** (peer `*`; bundles react-x, react-dom and react-jsx) **plus `@stylistic/eslint-plugin`** (peer `^9 || ^10`) for the two stylistic rules Norish sets:
  - `react/self-closing-comp: warn` → `@stylistic/jsx-self-closing-comp`;
  - `react/jsx-sort-props: warn` → `@stylistic/jsx-sort-props`, with the same options;
  - `react/prop-types: off` and the `jsx-runtime` config have no counterpart to carry over; take `@eslint-react`'s recommended TypeScript config.
- **eslint-plugin-jsx-a11y → `eslint-plugin-jsx-a11y-x`** (peer `^9 || ^10`). Its rule prefix is `jsx-a11y-x/` and it uses `configs.recommended`, not `flatConfigs`. Carry over the two rules set to warn, and the inline disable in `apps/web/components/groceries/stores/store-editor-panel.tsx:88`.
- **eslint-plugin-import is deleted.** `tooling/eslint/base.ts` registers it only to switch `import/order` off; the two `eslint-disable import/order` comments sit in globally ignored `__tests__` files and can go.
- **`includeIgnoreFile`** is deprecated in `@eslint/compat`; import it from `eslint/config` in `base.ts`.
- **The rule names differ, so the lint output changes.** Fix what the new recommended sets report, or switch a rule off with the reason in a comment.
- **`eslint:recommended` has three new error-level rules:** `no-unassigned-vars`, `no-useless-assignment` and `preserve-caught-error`.
  - A regex estimate finds about 8 `preserve-caught-error` hits, all in `packages/api/src/video/`: `yt-dlp.ts`, `processor.ts` and `processors/instagram.ts`.
  - Fix them by passing `{ cause }` to the rethrown error. Don't switch the rules off; if one is switched off, give the reason.
- **Unaffected:**
  - the new per-file config lookup (every package has its own config);
  - the `--flag unstable_native_nodejs_ts_config` flag, which is still valid in 10.12;
  - `eslint-env` comments (there are none).

**Improvement, in a separate commit.**

- `tooling/eslint/base.ts` turns on `projectService`, but no type-aware rule is enabled: it uses `tseslint.configs.recommended`, and the `no-unsafe-*` rules are off.
- Dropping `projectService` should cut lint time noticeably. It may also allow removing `--concurrency=1` from the root `lint` script, and the special handling in `apps/web/eslint.config.ts`.
- The alternative is to adopt `recommendedTypeChecked` deliberately.
- Measure either way with `TIMING=1`.

## Acceptance criteria

- [ ] **No crashes.** No "getFilename is not a function" and no rule-loading errors anywhere.
- [ ] **New rules.** Hits are fixed rather than disabled, or disabled with a reason.
- [ ] **Warning counts.** Compared with the 9.39.5 baseline and recorded in the comments, with every rule that was switched off listed with its reason.
- [ ] **Old plugins gone.** `pnpm why eslint-plugin-react eslint-plugin-jsx-a11y eslint-plugin-import` prints nothing.
- [ ] **Timing.** `pnpm lint` wall time before and after is recorded, including the `projectService` experiment.
- [ ] **Gates.** `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build` pass.

## Comments

- Filed 2026-10-12 with the spec.
- Sources:
  - the eslint 9.39.5 and 10.12.0 tarballs;
  - `migrate-to-10.0.0.md` at v10.12.0;
  - the tarballs of eslint-plugin-react 7.37.5, jsx-a11y 6.10.2, eslint-plugin-import 2.32.0 and `@eslint/compat` 2.1.1.
- 2026-10-13 — The maintainer chose the replacement plugins over `fixupPluginRules`. Checked: `@next/eslint-plugin-next` 16.4.0 pulls none of the old plugins; react-hooks 7.1.1, typescript-eslint, unused-imports 4.4.1 and turbo already accept ESLint 10.
- 2026-10-13 — Done on ESLint 10.12.0 / `@eslint/js` 10.0.1. eslint-plugin-react → `@eslint-react/eslint-plugin` 5.26 (`recommended-typescript`) + `@stylistic/eslint-plugin` 5.10 (`jsx-self-closing-comp`, `jsx-sort-props` with the same options); jsx-a11y → `eslint-plugin-jsx-a11y-x` 0.2 (`recommended`, same two rules at warn); eslint-plugin-import and `@eslint/compat` removed (`includeIgnoreFile` from `eslint/config`). `@eslint-react`'s copies of the hooks rules (`exhaustive-deps`, `purity`, `rules-of-hooks`, `set-state-in-effect`, `set-state-in-render`) are off because eslint-plugin-react-hooks owns them; its `disable-conflict-eslint-plugin-react-hooks` config goes the other way (turns react-hooks off) and would have re-enabled rules the repo switched off deliberately. Its `rules-of-hooks` also misread Playwright fixtures' `use()` as React's. Fixed rather than disabled: 10 `preserve-caught-error` (causes added), 3 `no-useless-assignment`. One inline disable: landing's `flushSync` inside `startViewTransition`, already explained there. Warnings: 478 → 635. The +157 are @eslint-react style findings left at warn: `naming-convention-ref-name` 57, `no-array-index-key` 38, `no-use-context` 20, `no-context-provider` 18, `use-state` 11, `dom-no-dangerously-set-innerhtml` 6, a handful of singles. The flagged event-listener "leaks" in `swipable-row.tsx` were not leaks; dropping their `as any` casts let the rule see the matching removals. Lint 36 s on ESLint 9; see the next commit for the `projectService` measurement.
