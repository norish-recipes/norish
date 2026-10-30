# 40: A parent confirmed in 0.25 keeps AI away from its food

**What to build:** Found by the audit of ticket 31's final run (2026-10-22, `m31c_post_on`, HEAD 0dab43bd8). With AI on, 40 own foods (74 lines) are left as near-duplicates of another food: "chilli flakes", "chili vlokjes" and "chili vlokken" beside "chili flakes"; "kippendijen" beside chicken thigh; "eiwitpoeder" beside protein powder; "applesauce" beside "apple sauce".

**The cause.** AI never read 37 of the 40. Each has `parent_chosen`, and `askableByAI` (`packages/db/src/repositories/ingredient-catalogue.ts`) skips a food a person parented. In 0.25 the flag was set by `setParent`, and confirming a parent suggestion went through `setParent` too (`confirmSuggestion`, Confirm all included). So the flag mostly records a click on AI's or the words' suggestion, not a parent a person picked.

- On the 0.25 copy, 498 of 707 own foods have it. After the first start, 428 of the 511 listed own foods still do, so the pass asked about 134 foods in every run of ticket 31.
- The same flag keeps AI from all 29 joined foods left (ticket 44), and from 14 of the audit's 18 wrong parents, all from 0.25 (sugar snaps under sugar, salam blaadjes under salami, king prawns under apples, red pepper flakes under red bell pepper).
- The other 3 were asked, and AI's names came close without matching: "baby potatoes with skin" for "krieltjes in schil" beside baby potatoes, "baking spray" / "cooking spray" beside "cooking oil spray", "taco" beside taco shells. The lookup takes an exact name or a slip of the fingers only (ticket 15 removed the word-start search). This ticket does not change that.
- Copies asked in the same pass are not a problem: the copy asked second finds the first by AI's English name ("chili flakes"), whichever order they come in.

**Fix (Mike, 2026-10-22: option B, "we need a proper cleanup"):** 0.25's `parent_chosen` stops counting. The first start forgets it once on every own food, just before the AI pass, so AI may ask about those foods and merge, split, rename, delete or re-parent them, each an AI Change with Undo. `askableByAI` keeps its `parentChosen` check: a parent a person chooses after the upgrade still keeps AI away, as today.

- Cost: about 430 more foods at the first start on the copy, roughly three times ticket 31's 163 requests and 232k tokens.
- Not taken (option A): a chosen parent protecting only the parent. It would have kept the 14 old wrong parents.

**Blocked by:** None

**Status:** done

- [x] A food whose parent was confirmed in 0.25 is asked about after the first start, and AI may change it (merge, re-parent, ...).
- [x] AI never changes a parent a person chose after the upgrade.
- [ ] On a rerun of ticket 31's measurement, "chilli flakes", "chili vlokjes" and "chili vlokken" name one food with "chili flakes". (Not rerun here; the next measurement checks it.)

## Implemented (2026-10-22)

- `CLEANUP_VERSION` 3 -> 4 (`packages/shared-server/src/ingredients/seed/first-start-cleanup.ts`). New step 7 calls `unmarkChosenParents()` (`packages/db/src/repositories/ingredient-catalogue.ts`), one update clearing `parent_chosen` on own foods (`off_id is null`); the AI pass is step 8. `CleanupOutcome.unmarked` counts them.
- Guard: `oncePerVersion` (`seed/catalogue-seed.ts`) now hands `pass` the version last run (0 for none). The step runs only when coming from below `PARENTS_UNMARKED_IN = 4`, so a later `CLEANUP_VERSION` bump never clears parents people chose after the upgrade. Later tickets bumping `CLEANUP_VERSION` must leave `PARENTS_UNMARKED_IN` at 4.
- 2026-10-22 (ticket 60): `PARENTS_UNMARKED_IN` is gone. No shipped release ran the cleanup, so every real upgrade comes from 0; the step now runs on an instance's first cleanup (`from === 0`), which still keeps a later `CLEANUP_VERSION` bump away from parents chosen since. An rc database that ran cleanup 1-3 keeps its marks.
- Seeded foods keep their mark: AI never asks about them, and clearing it would let the seed's parent pass re-file them.
- The no-AI passes that skip a chosen parent: seed corrections (`listUnchosenOwnChildren`/`refileOwnFood`), the mint recheck (`listUndecidedMints`, `adoptPlainName`, `fileUndecidedMint`) and the seed's parent pass. On the upgrade boot the first two run before the cleanup (`apps/web/server/index.ts`), so none of them re-files an unmarked food without asking. The mint recheck also needs `flagged`, which 0.25's `setParent` cleared. After the upgrade, a later `SEED_CORRECTIONS_VERSION` or `RUNG_VERSION` bump treats these foods like any food AI filed, which they are by then.
- Test: `first-start-cleanup.test.ts`, "lets AI ask about and re-file a food whose parent was confirmed in 0.25, not one chosen since". It also runs a later cleanup version (stored `CLEANUP_VERSION + 1`) to show the mark of a parent chosen since stays.
- Docs: the 0.26 release notes get a Fixes line, and the upgrade note on the first-start cleanup now says that confirmed parents stop counting, that each change has Undo, and that the first pass costs about three times the requests and tokens. The Ingredients page sentence ("AI leaves alone an ingredient you ... gave a parent") still holds for parents chosen from now on, so it is unchanged.

## Review fixes (2026-10-22)

- Step 7 (`unmarkChosenParents(tx)`, which now takes the transaction) and step 6 (`unflagHiddenFoods`) run under the tree lock (`underTreeLock` in `first-start-cleanup.ts`), taken first as every catalogue write takes it.
