# 30: A colon line keeps the food an old spelling gave it

**What to build:** Found by ticket 12. On the production copy, 11 recipe lines that end in a colon ("Voor de salade:") still name a food after the first start's cleanup, with AI off and on. This release names no food for a colon line it resolves, but the cleanup's step 3 gives the spelling "Voor de salade:" its clean text "Voor de salade" in place, so the line keeps lettuce. The spec's Problem Statement names these 11 lines as wrong.

**Fix:** in the cleanup's steps 2 and 3, an own spelling whose text ends in a colon is removed instead of cleaned in place. Its rows are then resolved again, and a colon line with no amount names no food (`lineNamesNoFood`), as a fresh import does. The line's text stays as written. `CLEANUP_VERSION` goes up.

**Blocked by:** None

**Status:** done

- [x] After the first start, no line ending in a colon names a food; its text is unchanged.
- [ ] All `CONTRIBUTING.md` gates pass.

## Implemented (2026-10-21)

- `first-start-cleanup.ts`: in steps 2 and 3 an own spelling a line would name no food by (`lineNamesNoFood({ text })`, so a colon at the end, also a heading or no letters) is never cleaned in place; it goes to `removeVariants`, whose rows `resolveAgain(…, { mint: true })` resolves again. `CLEANUP_VERSION` is 2. Correction (2026-10-21): the bump does not fix a database that ran version 1, which already cleaned "Voor de salade:" in place, so its spelling is no colon variant any more. Only rc/dev databases ran version 1 (0.26 is unreleased), and no code is added for them (no-legacy rule).
- A colon spelling can share its fold with its clean name, so `removeVariants` no longer "merges" a food that had only that spelling into itself: it deletes the food instead.
- `resolveAgain` (catalogue.ts) had a gap: a line whose text names no food was skipped, and kept the food's other spelling that `deleteCatalogueAlias` had moved it onto. Such a line now gets no food. The delete path is unchanged (its foods are gone already).
- Rows on a colon spelling, besides lines: a grocery "Voor de salade:" on lettuce is resolved again and gets the own food "Voor de salade", minted from the clean text, as a new grocery of that text would. A pantry item is not resolved again (`NamingRows` has none): on a kept food (lettuce) it stays on that food's other spelling; on a food that had only the colon spelling it goes with the food.
- Test: `first-start-cleanup.test.ts`, "removes a spelling ending in a colon…" (a colon spelling on seeded lettuce plus a lone own colon food, their lines and a grocery).
- No release-notes change: line 87 of `0.26.0-beta.md` ("Voor de salade:" names no food) now holds for old lines too.
- For ticket 31: after this, the measurement's "colon line, with a food" row should be 0 in both 0.26 runs.

