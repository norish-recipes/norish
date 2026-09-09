# 05 — E2E, docs and release notes

Status: ready-for-human
Blocked by: 01, 03, 04

Spec: `.scratch/grocery-line-cost/spec.md`

## What to build

**E2E.** The harness's fake shop page gains a pack size on every product, one product on Sale with a regular price and deal words, and one product sold by weight. The existing auto-link scenario asserts the loader before the price. New scenarios: "700 g" of a 500 g product reads two packs on the row and at the heading; the on-Sale product shows the badge and the struck price; correcting a Pack Size in the panel changes the row's packs after Save. Nothing visits a real shop.

**Docs.** `apps/docs/docs/groceries/prices.md` gains sections for what a line costs (packs, by weight, the one-pack note and the Pack Size editor), for the loader, and for Sales, with screenshots shot off the running dev server with `reducedMotion`; its "What this does not do yet" list is rewritten to the new Out of Scope (deal arithmetic, card prices, €/kg, history, mobile). `apps/docs/docs/release-notes/0.23.0-beta.md` extends its grocery prices section; no new page, since this ships on the same branch.

**ADR index.** ADR-0029 is already written and listed; confirm the index entry reads Accepted once the branch merges.

## Notes

Both E2E projects live under `apps/web/__tests__/e2e/` with Playwright fixtures; use `databaseUrl()` from `ai/database.ts`. After editing `packages/*`, rsync the injected `node_modules/@norish` copies and remove `apps/web/.next` before `build:web` or E2E, copies first.

Docs screenshots follow the conventions already used for the prices page.

## Acceptance criteria

- [x] E2E covers the loader, two packs at the heading, a Sale on the row, and a Pack Size corrected in the panel, against the harness's fake shop.
- [x] The prices docs page documents Line Cost, the Pack Size editor, the loader and Sales, with screenshots, and its not-yet list matches the spec's Out of Scope.
- [x] The `0.23.0-beta` release notes cover the feature in the established structure.
- [x] `pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, `pnpm test:e2e` and `pnpm build` pass.
