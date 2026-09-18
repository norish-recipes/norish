# 02 — Catalog schema, repository and name linking

Status: resolved

Spec: `.scratch/ingredient-catalog/spec.md`

## What to build

Migration `0053_ingredient_catalog`: `ingredient_catalog`, `ingredient_catalog_names` (unique folded name across the catalog), and `normalized_name` plus a set-null `catalog_ingredient_id` on `ingredients`. A repository that creates, updates (versioned), deletes and pictures entries, returning named outcomes; mint-time linking in the one Ingredient Name write funnel; relinking in SQL on every catalog write; and a startup backfill that folds names written before the column existed.

## Notes

The fold is JavaScript (`normalizeGroceryName`), so the backfill runs at startup rather than in the migration. The Pantry merged first with 0054, so this migration is 0055.

## Acceptance criteria

- [x] Adding, renaming, re-naming alternatives and deleting an entry link and unlink exactly the names they should.
- [x] A name another entry answers to is refused with that entry's name.
- [x] Recipe lines carry `catalogIngredient` from `getRecipeFull`; the share view carries only its picture.
- [x] The backfill is idempotent and never stops boot.

## Comments

- 2026-09-17: Implemented; 13 repository tests against Postgres, including an archive-shaped import and the share view.
