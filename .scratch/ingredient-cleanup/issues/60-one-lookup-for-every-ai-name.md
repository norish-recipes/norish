# 60: One lookup for every AI name

**What to build:** The ten-step refactor from the 2026-10-22 architecture review of the ingredient resolution. The text half (spelling keys, rungs, slips, resolve-then-write) stayed; the AI half had "sure" written three ways, merges decided in five places by five rules, and an error channel mixed into return values. Each rule now lives in one place. Behaviour-preserving except step 10.

**Blocked by:** None

**Status:** done

## Implemented 2026-10-22

Part 1, the resolver:
- `4e1dfc806` the resolver's `Spelling` carries one `key`, which replaces the three `plainFold || bareFold || fold` fallbacks, `sameFoodKey` and `asWritten`.
- `93299ab70` `foodSpelled` goes; the first-start cleanup uses `findIngredientIdByFold`.
- `4f68fcaaf` `findOtherFoodsNamed` splits into the recheck's `findOtherFoodsSpelled` and AI's `findFood(names, { except, among })`, one list per name, with the listed filter inside.
- `8d0f02498` `ResolveOptions` and `resolveAgain`'s flags become one `ResolveMode`.
- `1ababd3d8` one `readName(text)` replaces the boot passes' four `*Of` wrappers and `cleanupRules`.
- `ec6156736` the `ingredientFor` pass-through goes; tests read the repository.
- `e33d78fda`, `1cb80bea6` `RUNG_VERSION` drops its changelog; mode and `Spelling` comments.

Part 2, AI's answer (`ai/resolution/ingredient-resolution.ts`, `ingredients/review.ts`):
- `8ab87919f` `Pick { ingredientId, sure }`: the Decision judges a slip against `SURE_SLIP_THRESHOLD` itself, `sureOfSlip` goes.
- `0fac3f63b` the reading's parent is looked up once, before the category (tickets 56/57 rules kept).
- `c29881660` an unanswered question throws `Unanswered`, caught once in `askWhatFoodThisIs`.
- `6d4f20f03` `AIResolution = same | own | several | not-a-food | unanswered{reason}`, `sure` on each answer; `review.ts` is the one place a verdict becomes a change.

Part 3, AI Changes and the boot steps:
- `c89f1539f` one `lockForAI(tx, ids)` in `ingredients/ai-changes.ts` (tree lock, then the foods, "gone", then `isAskableByAI` on the first, "decided") replaces the copied preamble. `renameByAI` and `flagByAnswer` now take the tree lock too, so every AI Change takes the same locks in the same order.
- `cac14ae26` `PARENTS_UNMARKED_IN` and `NORISH_LANGUAGES_FIRST_IN` go: no shipped release ran either pass, so every real upgrade comes from 0. The unmarking of 0.25's parents runs on an instance's first cleanup (`from === 0`), so a later `CLEANUP_VERSION` bump still leaves parents chosen since alone. The seed's validators are forgotten whenever the corrections run on a seeded instance; a later `SEED_CORRECTIONS_VERSION` bump just makes the nightly refresh apply the file once more. An rc database that ran cleanup 1-3 keeps its marks. Tickets 40 and 42 have notes.

Part 4, the one behaviour change:
- `4f5b23f32` the Plain Name merge (`plain-names.ts`) goes through `findFood([plain], { except, among: "listed" })` and takes the food the name finds as written. It no longer merges into a hidden food, or into a food that spells the name only in a language Norish does not read, and the name beats another food's spelling. A slip never merges. Since the plain name is the only name and has to find the food itself, ticket 57's rule makes it a merge even when that food is the parent, so no parent guard is needed. `findIngredientHolding` is deleted. CONTEXT.md's Plain Name entry says "listed" and "in a language Norish reads". Tests: `plain-names.test.ts` "merges into a food spelling the plain name only where a recipe line lists it", "never merges into a food spelling the plain name only in a language Norish does not read", "merges into a listed food by the spelling the plain name finds".

Source over the whole refactor (`e931bfb99..4f5b23f32`, without tests and docs): 11 files, +287 / -359.

## Watch

- `publish-script.test.ts` failed once during the refactor and did not reproduce. If it fails again, reproduce it with `--repeat-each` and fix the race.

## Round 2 (2026-10-23)

- `2a1976b0d` one `closesCycle(tx, id, parentId)` in `ingredient-relocation.ts` (the parent is the food, or sits under it) replaces the ancestor checks in `setParentIn`, `parentByAI`, `reverseChange` and `fileUnder`. The seed's in-memory check is renamed `closesCycleIn`.
- `2c798a595` one `lockFoods(tx, ids)` in `ingredient-relocation.ts` (tree lock, then the rows, true where every distinct id is there) replaces the preamble in `lockForAI`, `lockAddedSpelling`, `setParentIn`, `deleteIngredient`, `splitFood`, `lockSpellingOn` and `mergeCatalogueIngredients`, which now refuses a merge into itself by its ids. `setParentIn`'s own self-parent check went, since `closesCycle` covers it.
- `1fd513fb3` fix: `moveAlias` onto the spelling's own food is the no-op it was written as, not "not-found" (merge.test "leaves a spelling moved onto its own food where it is").
- `359b5b9cb` `mergeCatalogueIngredients` writes its target in one update, the flag fragment conditional on `keepFlag`.
- `24ad39d87` `adoptPlainName` checks a free name through `nameIsFree`; `settleIngredientName(id)` only settles, and `renameToPlainName(tx, id, name)` renames, settles and adds the spelling (used by `renameByAI`).
- `9faf134aa` fix (reports only): `renameByAI` returns `ApplyOutcome | "settled"`; one `skippedBy(outcome)` in `ai-changes.ts` maps an outcome to skipped ("gone" is "not-found") for review.ts and plain-names.ts. `parentByAI` says "cycle" (review reports `skipped: cycle`, and a parent gone `skipped: not-found`, where it said `distinct`); the spelling check says "seeded" / "last-spelling" (`SpellingOutcome`). `findFoodNamed` returns `{ kind: "found" | "not-found" | "unanswered" }`. Plain-names reports a decided or gone food as such, not "settled".
- `1d04e9dce` `parentOf(food, options, orCategory)` in `ingredient-resolution.ts` holds ticket 65's shortcut (now `{ id, sure }`, no faked `Found`), the parent lookup and the category (only where the names found nothing); 53's kept parent is the `keptByAI` const. `findByName`/`findNamed` take `among` instead of `{ seeded }`.
- Finding 6 (`ResolveMode` table) skipped: a `Record<ResolveMode, { slips; mints; announces }>` is about +3 lines over the five one-line comparisons, and `mintFlag` would still single out "upgrade" (or tie its flag to `announces`), so it is not shorter or clearer.
- `321ee4207` `resolveAgain` and `resolveByOwner` moved from `catalogue.ts` to `ingredients/resolve-again.ts`; `ai-changes`, `correct-seed`, `first-start-cleanup` and `deleteIngredient` import it from there.
- `db60a9eee` `parentOf(parent, category, options)`: no `orCategory` flag; `readThenLookUp` passes the category as null where the names found a food.
- `35c7ef2f4` `readName().parts` goes through `readByWords([spelling], junkKept, true, ownId)` (new `exceptId` drops the food's own aliases). One reading differs: a joined name another food holds whole is no longer split, as `readByWords` never splits a name known whole. `currentRules`'s comment is back on it.
- `a6463b7cb` the AI reading in `ingredient-resolution.ts` is `askReading`; `readName` is only the resolver's rules reading.
- `f32dbaa66` deleted the unused `editableIngredient` (catalogue.ts) and `findIngredientById` (db `ingredients.ts`), and the test-only `applySeedFile`: `applySeedEntries` is exported and catalogue-seed.test builds the same helper from `seedEntriesOf`.
- `431f20a18` `spellingsBeside` deleted: `removeVariants` uses `findCatalogueAliasOwner` and `countAliasesOf`.
- `1fd4939ee` `setIngredientFlagReason` takes a `FlagReason`. `29c892b07` `correctSeed` reads `toId` as `move.to === null ? null : seeded.get(move.to)` with a comment on the two cases. `b9b3ce618` `runOnBoot(seedJunkPileOnce, ...)`.
- The six `packages/api/src/startup/*` ingredient boot files stay. Putting them in one module would save about ten import lines, but every boot test would then load all five shared-server passes and the queue producers, and index.ts reads as the boot order either way.
- `8fc37b4e3` every comment in the cleanup and resolution code (the review's 61: catalogue, ingredient-catalogue, relocation, resolver, catalogue-seed, aliases, seed repo, changes, minted, recipe-lines, the AI resolution files) is at most two lines. The nutrition and icon files (27 more) were not in scope and were left.
- `df1140d84` fix: the first-start cleanup's `removeVariants` merges with `keepFlag: true`, as the recheck does: no one decided that merge, so a flagged target (an `ai-off` mint) stays flagged.
- `075e8a390` fix: `findFood` drops foods outside `among` before matching (`otherFoodsSpelled(except, spellings, among)`, one `findIngredientIdsAmong` over the exact and named candidates), so AI's name matching a hidden food exactly falls through to the listed slip. The old after-filter stays for slips.
- `ba71be532` test pin for `35c7ef2f4`: an own food named "zout en peper" whose whole name another food spells is not split, renamed or removed; it stays a duplicate for step 8, the AI pass (it is askable), which may merge it. Nothing more built.
- No release-notes line: all three change 0.26's own cleanup and AI lookup, not anything a 0.25 instance did.
- 2026-10-23 Round 2: `a58a1db49` the resolver's `spellingOf` takes the keys function it reads by (`spellingKeys`, or `wholeSpellingKeys` in `spelling-keys.ts` for AI's names in `findFood`) in place of a `whole` flag, as `9da73a9fc` did for `sameFood`; `wholeFoodKey` reads through `wholeSpellingKeys`.
