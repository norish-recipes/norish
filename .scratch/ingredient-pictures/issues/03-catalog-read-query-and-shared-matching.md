# 03 — The catalog read query and shared matching

Status: resolved
Blocked by: 02

Spec: `.scratch/ingredient-catalog/spec.md`

## What to build

`ingredientCatalog.list` for every signed-in reader; a shared-react hook that returns the list and a lookup cached per payload; and a pure `packages/shared/src/lib/ingredient-catalog.ts` with exact matching, suggestion ranking, name-part location and name-part replacement.

## Acceptance criteria

- [x] Matching is exact equality of the grocery folding and nothing looser.
- [x] Suggestions rank prefix, then word-prefix, then substring, and leave out the entry already matched.
- [x] A grocery list asks the hook once per row without rebuilding the lookup per row.

## Comments

- 2026-09-17: Implemented with unit tests in `packages/shared`.
