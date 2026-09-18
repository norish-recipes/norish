# 04 — Administrators manage the catalog

Status: resolved
Blocked by: 02, 03

Spec: `.scratch/ingredient-catalog/spec.md`

## What to build

`admin.ingredientCatalog.{create,update,delete}` and an Ingredient Catalog card in admin settings that opens a searchable panel, with a nested editor panel for the name and other names. A new entry stays open after Create so it can take a picture. Duplicates are said in the form, from the cached catalog, before the server refuses them.

## Acceptance criteria

- [x] Non-administrators cannot write.
- [x] Duplicate, stale, missing and unusable names each reach the administrator as their own error.
- [x] Deleting asks first and says recipe text is kept.

## Comments

- 2026-09-17: Implemented; router tests over mocks, browser coverage in the E2E spec.
