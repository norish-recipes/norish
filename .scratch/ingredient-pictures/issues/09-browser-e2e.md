# 09 — Browser E2E

Status: resolved
Blocked by: 06, 07, 08

Spec: `.scratch/ingredient-catalog/spec.md`

## What to build

`apps/web/__tests__/e2e/ai/ingredient-catalog.e2e.ts` on the `ai` project.

## Acceptance criteria

- [x] An administrator adds Egg with the other name "eggs", draws its picture, and the imported recipe's "eggs" line shows it while "chives" does not.
- [x] A hand-typed "6 Eggs" grocery shows the picture.
- [x] The editor suggests Egg for "5 g eg" and rewrites the line to "5 g Egg" with its picture.

## Comments

- 2026-09-17: 3 passed against a production build.
