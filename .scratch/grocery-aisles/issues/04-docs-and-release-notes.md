# 04 — Docs and release notes

Status: ready-for-agent
Blocked by: 02, 03

Spec: `.scratch/grocery-aisles/spec.md` · Decision: ADR-0031

## What to build

A reader of the docs finds an **Aisles** page under Groceries that says, in the shopper's words, what an aisle is, how a Store gets them, how a grocery is filed by drag or from its panel, that filing teaches the Store the name for good, that unfiled groceries sit at the top, and what this does not do yet (the spec's Out of Scope). Screenshots are shot off the running dev server with reduced motion, following the conventions the prices page's screenshots used: the store editor with aisles, a Store block shown by aisle, the panel's Aisle field.

The current release-notes checkpoint page gains a feature section for aisles in the established structure; if the checkpoint has moved by then, the new checkpoint's page is where it goes. The ADR index entry for ADR-0031 reads Accepted. A final pass confirms every new string exists in all fourteen locales and uses the word Aisle.

## Notes

- The spec's docs screenshot conventions are in the grocery line cost directory's screenshot spec; never run it in the same Playwright invocation as the grocery prices E2E.
- Prior art: the prices docs page and the `0.23.0-beta` release notes.

## Acceptance criteria

- [ ] An Aisles page under Groceries documents setup, filing by drag and panel, the memory, unfiled rows and the not-yet list, with screenshots.
- [ ] The release notes for the current checkpoint cover aisles in the established structure.
- [ ] The ADR index lists ADR-0031 as Accepted.
- [ ] `pnpm i18n:check` passes and every new string uses Aisle.
- [ ] `pnpm lint`, `pnpm test:run`, `pnpm test:e2e` and `pnpm build` pass.
