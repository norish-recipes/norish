# 01 — A household Pantry

Status: ready-for-human
Blocked by: none

Spec: `.scratch/pantry/spec.md` · Decision: ADR-0032

## What to build

The `pantry_ingredients` table and its migration; the repository (list by user ids, find in household by folded name, create with the client's id, owner id, delete); the zod contracts, DTOs and the shared matching helper; the pantry router (list, add, remove) with its emitter and subscriptions, registered on the app router; the shared-react factory hooks (query, mutations, subscription, idempotent merges) and the web binding; the Pantry panel opened from the groceries page's gear menu; the pantry query in the Warm Set; strings in all fourteen locales.

## Acceptance criteria

- [x] One folded name per member; the household's Pantry read in one query; deleting the member cascades (repository tests).
- [x] A duplicate name answers with the existing id and emits nothing; another household's item cannot be removed; add and remove emit `added` and `removed` (tRPC tests).
- [x] The merges are idempotent (shared-react test); the Pantry panel adds on Enter, refuses a duplicate by folded name, removes with one press (component test).
- [x] `pnpm i18n:check` passes with the new keys in every locale.
