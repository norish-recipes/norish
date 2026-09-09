# 04 — Docs and release notes

Status: ready-for-human
Blocked by: 02, 03

Spec: `.scratch/grocery-aisles/spec.md` · Decision: ADR-0031

## What to build

A reader of the docs finds an **Aisles** page under Groceries that says, in the shopper's words, what an aisle is, how a Store gets them, how a grocery is filed by drag or from its panel, that filing teaches the Store the name for good, that unfiled groceries sit at the top, and what this does not do yet (the spec's Out of Scope). Screenshots are shot off the running dev server with reduced motion, following the conventions the prices page's screenshots used: the store editor with aisles, a Store block shown by aisle, the panel's Aisle field.

The current release-notes checkpoint page gains a feature section for aisles in the established structure; if the checkpoint has moved by then, the new checkpoint's page is where it goes. The ADR index entry for ADR-0031 reads Accepted. A final pass confirms every new string exists in all fourteen locales and uses the word Aisle.

## Notes

- The spec's docs screenshot conventions are in the grocery line cost directory's screenshot spec; never run it in the same Playwright invocation as the grocery prices E2E.
- Prior art: the prices docs page and the `0.23.0-beta` release notes.

## Acceptance criteria

- [x] An Aisles page under Groceries documents setup, filing by drag and panel, the memory, unfiled rows and the not-yet list, with screenshots.
- [x] The release notes for the current checkpoint cover aisles in the established structure.
- [x] The ADR index lists ADR-0031 as Accepted.
- [x] `pnpm i18n:check` passes and every new string uses Aisle.
- [x] `pnpm lint`, `pnpm test:run`, `pnpm test:e2e` and `pnpm build` pass.

## Comments

- 2026-09-07: implemented across six commits on `feat/grocery-categories` (design record, tickets 01–04, E2E fixes), then a two-axis `/code-review` against `6ce62f45` whose findings were fixed in a follow-up commit: a held Aisle choice no longer survives a Store swap or a closed Add panel, an aisle removed in the editor is never reported as a name's aisle, aisle names are capped at 100 characters in the editor too, the not-yet list matches the spec's Out of Scope, the grouped E2E scenario files "kip" and "kip (diepvries)" into two different aisles, and the filing procedure is `stores.fileGroceryName`. Screenshots come from `.scratch/grocery-aisles/docs-screenshots.e2e.ts`.
- 2026-09-09: Mike's follow-up after review — the aisle version is on the wire and guards renames (ADR-0004), aisle links join the Warm Set and are pruned on store events so the list groups by aisle offline and stays honest; a **Done** heading over the done tail of a Store with aisles, block headings a size larger; and the intermittent "marking done unmarks it again" was diagnosed with a browser loop and fixed at its root: a create shifts every sibling's version and now hands those rows back and announces them.
