# 10 — Docs, release notes, ADR and glossary

Status: resolved
Blocked by: 09

Spec: `.scratch/ingredient-catalog/spec.md`

## What to build

The feature documented where a user and a self-hoster look for it, the target version's release notes, ADR-0037 with its index entry, and the glossary terms.

## Notes

Screenshots are captured by `.scratch/ingredient-catalog/docs-screenshots.e2e.ts` (instructions in its header). No environment variable was added, so there are no Upgrade notes.

## Acceptance criteria

- [x] `recipes/ingredient-pictures.md` with screenshots; Hidden Items, admin settings and the Prompts section updated.
- [x] 0.23.0-beta release notes describe the feature.
- [x] ADR-0037 and its index entry; CONTEXT.md gains Ingredient Name, Ingredient Catalog, Catalog Ingredient, Catalog Name and Ingredient Illustration.
- [x] The docs site builds and its link check passes.

## Comments

- 2026-09-17: Implemented; `apps/docs` `pnpm build` passes.
