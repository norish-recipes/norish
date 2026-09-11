# 03 — Docs, browser scenarios and release notes

Status: ready-for-human
Blocked by: 02

Spec: `.scratch/pantry/spec.md`

## What to build

The pantry browser spec in the `ai` Playwright project with its support module (seeded recipe, database readers); CONTEXT.md entries for Pantry and Pantry Ingredient; ADR-0032 and its index entry; the Pantry docs page under Groceries with two screenshots shot off the running app; a Pantry feature section on the `0.23.1-beta` release-notes page.

## Acceptance criteria

- [x] E2E: a name typed into the Pantry is kept and refused a second time; a stocked ingredient is shown apart and left off the list; ticked, it is added; removed from the Pantry, it is to buy again.
- [x] Docs page, glossary entries, ADR and release notes written.
- [x] Screenshots captured with `.scratch/pantry/docs-screenshots.e2e.ts`.
- [x] `pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, `pnpm test:e2e` (pantry spec) and `pnpm build` pass.
