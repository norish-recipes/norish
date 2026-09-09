# 01 — Aisles on a Store

Status: ready-for-human
Blocked by: none (can start immediately)

Spec: `.scratch/grocery-aisles/spec.md` · Decision: ADR-0031

## What to build

A household member opens the store editor and, under the icon picker, finds the Store's **Aisles**: a field that adds one by name with Enter or a plus, inline rename, drag reorder and an X to remove. A name the Store already has, compared case-insensitively, is refused inline. Nothing is written until the editor's footer Save, which saves the aisles with the Store in one update; a new Store can be created with its aisles in the same go, and removing an aisle needs no confirmation.

Once saved, the Store's block in the list shows every aisle as a slim heading in the Store's order, in both the flat and the grouped view, rendered whether or not anything is under it, an empty one quieter than a filled one. Since nothing is filed yet, every row still sits at the top of the block, under no heading, exactly where it sat before; the Store heading, its total, its menu and its done tail are unchanged. A Store with no aisles renders exactly what it renders today.

Aisles travel with the Store: an ordered list on the Store DTO, carried by the create and update inputs (reconciled by client-minted id: rename and reposition the known, create the new, delete the absent), present on every Store event the household already receives, and visible read-only on the public stores endpoint. Deleting a Store deletes its aisles.

One migration adds the aisles table: id, store, name, sort order, timestamps, version; unique per store on the folded name; cascade from the store.

## Notes

- Vocabulary is CONTEXT.md's: Aisle, never Category, Department or Section. New strings land in all fourteen locales in this ticket.
- The Store DTO gaining a required field touches every test fixture that builds a Store literal; fix them in this ticket rather than loosening the type.
- Prior art: the store manager panel test for the editor, the stores procedure tests for events, the store products repository test for the database seam, and the grocery prices E2E for the list.
- After editing shared packages, refresh the injected `@norish` copies and remove the web build cache, copies first, before a build or E2E run.

## Acceptance criteria

- [x] The store editor adds, renames, reorders and removes aisles, refuses a duplicate name case-insensitively, and writes nothing until Save.
- [x] Saving a Store with aisles persists them in order; an aisle removed from the list is deleted; a Store deleted takes its aisles with it (repository tests).
- [x] Every Store event carries the Store with its aisles, and the client merges by store id (tRPC tests).
- [x] The public stores endpoint lists a Store's aisles; the REST create is unchanged.
- [x] Every aisle of a Store renders as a slim heading in order in the flat and grouped views, empty ones quieter; all rows stay unfiled at the top; a Store without aisles renders exactly as before.
- [x] E2E: adding two aisles in the editor makes both headings appear with the list unchanged above them.
- [x] `pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, `pnpm test:e2e` and `pnpm build` pass.
