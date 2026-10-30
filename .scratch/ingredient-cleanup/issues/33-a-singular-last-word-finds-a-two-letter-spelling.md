# 33: A pass without AI leaves a hidden food alone

**What to build:** Found by ticket 31. The first start's recheck filed "Nora reserve eten", a grocery food, under meat (`filed: 1`): the words read its last word "eten" in the singular, "et", which is meat's Turkish seed spelling. A grocery's aisle walks its food's parent chain, so the grocery moved to the meat aisle. The food is hidden (ticket 25), so AI never asks about it and nothing corrects the parent.

**Fix (Mike, 2026-10-22):** "the run without ai should also leave groceries alone of course that should just be an early return its that simple". Every automatic pass without AI that would file, merge or re-file an own food skips a hidden one (not `listedFood`), as AI does. The import-time resolver stays as it is: a new grocery line resolving its text is fine.

**Open, not built:** the short singular reading ("eten" read as "et") can still give a listed food a wrong parent from its words. A minimum length for a singular reading, or the singular only of a word in the language whose plural rule made it, is for later.

**Blocked by:** None

**Status:** done

- [x] A grocery food is not filed, merged or re-filed by the recheck.
- [x] The seed correction does not re-file a hidden food either.
- [ ] All `CONTRIBUTING.md` gates pass. (shared-server, db and queue suites, typecheck and lint of db and shared-server green; the full repo gates are the orchestrator's run)

## Implemented (2026-10-22)

- One guard where each pass lists its candidates: `ingredientIsListed()` (new export in `packages/db/src/repositories/ingredient-catalogue.ts`, `listedFood` on the outer `ingredients` row, built per call like `ingredientIsNamed`; it also replaces the two identical `listedFood({ id, offId })` calls there). `listUndecidedMints` (the recheck, `recheck-mints.ts`) and `listUnchosenOwnChildren` (the seed correction, `correctSeedOnce`) in `packages/db/src/repositories/ingredient-seed.ts` require it, so a hidden food is never merged, renamed, filed or re-filed by them. Ticket 25's note that `recheck-mints` still merges a hidden food as an import does no longer holds.
- Left as they are: the first-start cleanup (`first-start-cleanup.ts`) cleans spellings, splits joined names and renames, and files nothing; its rows resolve again as an import would. The first seed's `mergeExistingIntoSeed` merges a food whose spelling is a seeded one, as resolving does. Neither reads a parent from the words.
- No `RUNG_VERSION` or `SEED_CORRECTIONS_VERSION` bump: an instance that already ran the pass keeps its filing (only rc/dev databases, Mike's no-legacy rule).
- Tests: `recheck-mints.test.ts` "leaves a grocery food alone: no parent from its words, no merge" (red first: `{ merged: 1, filed: 1 }`); `catalogue-seed.test.ts` "moves seasoning off coating once..." now names "chicken seasoning" in a recipe and keeps a grocery food "bbq seasoning" under coating (red without the guard: `refiled: 3`).
- Docs: the 0.26 release-notes line on hidden ingredients says the first start no longer files one again; `CONTEXT.md` (Ingredient) says no pass without AI touches a grocery food.

## Review fixes (2026-10-22)

- The first-start cleanup's step 5 now leaves a hidden food alone too: `listOwnFoods` (`packages/db/src/repositories/ingredient-cleanup.ts`) requires `ingredientIsListed()`, so a grocery food is neither split nor renamed. The "Left as they are" note above no longer holds for step 5. Test: `first-start-cleanup.test.ts` "neither splits nor renames a hidden food".
