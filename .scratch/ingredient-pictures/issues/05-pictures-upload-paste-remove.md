# 05 — Pictures: storage, serving, upload, paste and remove

Status: resolved
Blocked by: 04

Spec: `.scratch/ingredient-catalog/spec.md`

## What to build

`storeIngredientIllustration` normalizes any accepted image (HEIC included) to a 512px WebP square under a new filename, points the entry at it and sweeps all but the new file and its predecessor. A Next route serves `/ingredient-images/<file>` immutable and public, excluded from the auth proxy for signed-out share pages. Upload, clipboard paste and remove in the editor panel.

## Acceptance criteria

- [x] Every stored picture has a URL no earlier picture had.
- [x] Nothing is left on disk for an entry deleted meanwhile, or deleted outright.
- [x] The route refuses anything but a stored picture's filename.

## Comments

- 2026-09-17: Implemented; storage test runs real sharp against a temp uploads dir.
