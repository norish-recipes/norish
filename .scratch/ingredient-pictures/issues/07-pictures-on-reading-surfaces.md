# 07 — Pictures on recipe pages, step chips and groceries, and hiding them

Status: resolved
Blocked by: 03

Spec: `.scratch/ingredient-catalog/spec.md`

## What to build

`IngredientIllustration` beside lines in the shared read-only ingredient list (recipe page, cooking mode, share page), inside step ingredient chips, and beside grocery, grouped grocery and add-to-groceries rows. `ingredientPictures` joins Hidden Items, read through a provider-optional hook so the share page shows everything.

## Acceptance criteria

- [x] A line without a matching name looks as it did before.
- [x] A picture that fails to load disappears rather than showing a broken image.
- [x] Hiding ingredient pictures removes them everywhere for that reader.

## Comments

- 2026-09-17: Implemented; component tests for hidden, error and share-page behaviour.
