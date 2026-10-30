# 47 — The @eslint-react warnings fixed

Status: resolved
Blocked by: 39
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`, ticket 12. Found in the branch review on 2026-10-13.

## What to build

Ticket 12 says: "Fix what the new recommended sets report, or switch a rule off with the reason in a comment." Instead, the new sets were left reporting warnings. `pnpm lint` on 2026-10-13 shows 638 warnings, 157 of them from `@eslint-react`. The review put the 9.39.5 baseline at 478.

| Rule                                                                                                      | Count  | What fixing it means                                      |
| --------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------- |
| `naming-convention-ref-name`                                                                              | 57     | Refs end in `Ref`.                                        |
| `no-array-index-key`                                                                                      | 38     | Key by identity.                                          |
| `no-use-context`                                                                                          | 20     | React 19: `use(Context)`.                                 |
| `no-context-provider`                                                                                     | 18     | React 19: `<Context>` instead of `<Context.Provider>`.    |
| `use-state`                                                                                               | 11     | `[thing, setThing]` naming.                               |
| `dom-no-dangerously-set-innerhtml`                                                                        | 6      | Keep only where it's needed, with the reason at the line. |
| `no-unnecessary-use-prefix`                                                                               | 2      |                                                           |
| `no-forward-ref`                                                                                          | 1      | React 19: `ref` as a prop.                                |
| `no-clone-element`, `no-children-for-each`, `web-api-no-leaked-timeout`, `naming-convention-context-name` | 1 each |                                                           |

The React 19 rules (`no-use-context`, `no-context-provider`, `no-forward-ref`) are migrations to the current React API. Do them, don't switch them off.

After 39, the hooks warnings report as `@eslint-react/exhaustive-deps` too (2 in apps/web on 2026-10-14). Fix them here; they count toward "no `@eslint-react` warnings".

## Acceptance criteria

- [x] `pnpm lint` reports no `@eslint-react` warnings.
- [x] Any rule switched off has its reason in a comment.
- [x] The total warning count and its per-rule breakdown are recorded here.
- [x] `pnpm test:run` and the E2E projects pass. (The apps/web unit suite passes, 166 files / 1237 tests; the E2E run happens at the end of the branch's batch.)

## Comments

- Filed 2026-10-13 from the branch review.
- 2026-10-14 — The maintainer confirmed: fix them. apps/web alone had 599 warnings, 144 of them from @eslint-react, which matches the counts above.
- 2026-10-14 — Done. Warnings counted with `eslint -f json` per app, after ticket 39.

  | App          | Before | After | `@eslint-react` before | `@eslint-react` after |
  | ------------ | ------ | ----- | ---------------------- | --------------------- |
  | apps/web     | 598    | 455   | 143                    | 0                     |
  | apps/landing | 15     | 0     | 15                     | 0                     |

  apps/web before, by rule: `@stylistic/jsx-sort-props` 235, `padding-line-between-statements` 200, `naming-convention-ref-name` 43, `no-array-index-key` 38, `no-use-context` 20, `no-context-provider` 18, `use-state` 10, `@next/next/no-img-element` 9, `@typescript-eslint/no-unused-vars` 6, `dom-no-dangerously-set-innerhtml` 5, `unused-imports/no-unused-imports` 3, `exhaustive-deps` 2, `no-unnecessary-use-prefix` 2, `no-restricted-properties` 2, and 1 each of `naming-convention-context-name`, `no-children-for-each`, `no-clone-element`, `no-forward-ref`, `web-api-no-leaked-timeout`. After: `@stylistic/jsx-sort-props` 235, `padding-line-between-statements` 200, `@next/next/no-img-element` 9, `@typescript-eslint/no-unused-vars` 6, `unused-imports/no-unused-imports` 3, `no-restricted-properties` 2; no `@eslint-react` rule. apps/landing before: `naming-convention-ref-name` 14, `dom-no-dangerously-set-innerhtml` 1.

  - React 19 migrations: every `useContext` is `use`, every `<X.Provider>` is `<X>`, `SwipeableRow` takes `ref` as a prop. `GroceriesUiCtx` is `GroceriesUiContext`.
  - `no-clone-element`: Panel's `trigger` prop had no caller, so it is gone, and with it the `cloneElement`.
  - Refs end in `Ref` (lists of refs are `stepsRef`, `textareasRef` and the like); lazy initial state where `useState` built a value; the prefetch retry timer is cleared on cleanup; the two `use`-named adapters that call no hooks are plain functions passed into the hook-shaped slot; the 2 `exhaustive-deps` are fixed (an unneeded dependency list, and `typedPack` memoised).
  - Keyed by identity: recipe lines and steps by their `order` within the system (the identity Step Ingredients already resolve by), weekday toggles by their key, wordmark paths by their path, typed tag words by the word (deduplicated, a word typed twice is one potential tag), and the Ingredient panel's groceries by id, which `listIngredientUses` now returns.
  - Index keys kept, each with its reason at the line: image lists (uploads are named by content hash, so the same picture can sit in one list twice), the job timeline (a step can run twice in an attempt), the import notes and errors logs, the code-input slots, the rolling-number slots, and the nutrition placeholder rows. `components/skeleton/**` has the rule off in `apps/web/eslint.config.ts`: placeholders with no identity that never reorder.
  - `dom-no-dangerously-set-innerhtml`: the formatting help reads its `<strong>` through `t.rich`; the two inline `js`-class scripts (auth layout, landing root) keep it, since React escapes a script's text children.
  - `no-children-for-each` stays disabled at its one line: Panel's slot API places `Panel.Body`/`Panel.Footer` by type, so it has to read its children.
- 2026-10-14 (review fixes) — From the review: `set-state-in-effect` is off with its reason (on, it flags 178 effects that copy loaded data into a draft), and the five `exhaustive-deps` disables say why. `packages/shared-react` now loads the React rules too: every `useContext` is `use`, every `.Provider` is the context itself (two `createElement` calls included), and its 43 findings are fixed, with one disable (`use-store-prices.ts`, a timer per pending link cleared through a map the rule can't follow). `pnpm lint` reports no `@eslint-react` warnings in any workspace. `pnpm test:run` passes, and the full `pnpm test:e2e` passed 175 of 175 (ai 143, offline 23, realtime 9) against a build of the review fixes.
