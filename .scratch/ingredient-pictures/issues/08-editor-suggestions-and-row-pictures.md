# 08 — Editor suggestions and row pictures

Status: resolved
Blocked by: 03

Spec: `.scratch/ingredient-catalog/spec.md`

## What to build

A trigger-less name-suggestion mode in `SmartTextInput`, fed by the ingredient row from the parsed name part. A picture slot beside each row, shown once the row's stored name matches.

## Acceptance criteria

- [x] Picking a suggestion rewrites only the name; amount and unit stay.
- [x] Enter with nothing highlighted still moves to the next row.
- [x] A pasted multi-line value is never offered suggestions.
- [x] Free text is saved exactly as typed.

## Comments

- 2026-09-17: Implemented; jsdom tests plus the E2E editor scenario.
