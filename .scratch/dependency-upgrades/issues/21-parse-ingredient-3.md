# 21 — parse-ingredient 3

Status: resolved
Blocked by: None — can start immediately
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

Move `parse-ingredient` from 2.2.0 to **3.0.0** (packages/shared, `src/lib/helpers.ts`).

**What 3.0 changes:**

- **Removed deprecated exports:** `identifyUnit`, `fors*` and `rangeSeparator*`. Norish uses none of them.
- **Behaviour changes that can alter what Norish stores for an ingredient line:**
  - a leading `-` is now part of the description, which matters for bulleted ingredient lists;
  - quantities are never negative or `NaN`;
  - `meta.sourceIndex` now counts blank lines;
  - unit definitions are readonly.

**How:** tests first, then the bump.

1. Write regression tests against 2.2.0:
   - bulleted lines (`- 2 cups flour`, `• 1 tbsp oil`);
   - ranges (`2-3 cloves`);
   - negative-looking input;
   - input with blank lines between ingredients.
2. Bump to 3.0.0.
3. Adapt `helpers.ts` so the tests still produce the same ingredients — for example, strip a leading bullet before parsing.

**Later:** 3.0's `extractMeasurements()` could drive unit conversion inside step text.

## Acceptance criteria

- [x] **Regression tests.** They pass, with identical outputs before and after, or with deliberate differences listed in the comments.
- [x] **Imports.** URL imports, paste imports and grocery additions of bulleted lists produce the same ingredients as before.
- [x] **E2E and gates.** The ingredient-related E2E tests and the repo gates pass.

## Comments

- Filed 2026-10-12 with the spec.
- Source: the parse-ingredient 2.2.0 and 3.0.0 tarballs.
- 2026-10-13 — Unchanged.
- 2026-10-13 — Done on parse-ingredient 3.0.0, tests first. On 2.2.0, bulleted lines were already misread: `- 2 cups flour` gave no quantity and 2 as the upper bound of a range, `• 1 tbsp oil` was not parsed at all, and `* 3 eggs` came out as 3 of "*". **Deliberate difference:** `parseIngredientWithDefaults` now takes a leading bullet (`-`, `–`, `—`, `•`, `·`, `*` followed by a space) off before parsing, so those lines read as the line without the bullet on both versions. Ranges (`2-3 cloves`, `2 - 3 cloves`), a dash inside a line (`salt - to taste`) and blank lines between ingredients give the same output on 2.2.0 and 3.0.0, and the 865 shared tests pass unchanged on 3.0.0. `meta.sourceIndex` cannot change anything here: Norish parses one line per call and skips blank ones. Negative-looking input was misread too, on both versions: `-1 egg` came out as 1 of nothing and `-2 tbsp butter` as plain text, so a dash right against the amount is taken off as a bullet as well (no amount is negative); tested alongside the bullets.

