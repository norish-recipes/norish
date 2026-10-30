# 29: A joined food holding one part's spelling is never split

**What to build:** Found by ticket 12. With AI on, AI read "light cooking cream or non-fat Greek yogurt" as two alternatives, sure. The pass still flagged it unsure and left it whole. The food also carries the spelling "light cooking cream", so that part resolves to the food itself, and a split whose part is the food is refused. Its lines keep naming one joined food.

**Fix (Mike, 2026-10-21):** the part's spelling moves from the joined food to a new food of its own, and the split goes ahead:

- the spelling "light cooking cream" moves to a new food light cooking cream, and the lines it names follow it there (4 on the production copy, each naming only light cooking cream);
- a line "light cooking cream or non-fat Greek yogurt" names light cooking cream and greek yogurt, as alternatives;
- the joined food goes.

**Blocked by:** None

**Status:** done

- [x] A sure split of a joined food that holds one part's spelling makes the split, and that part gets a food of its own.
- [ ] All `CONTRIBUTING.md` gates pass. (shared-server ingredient tests, typecheck and lint pass; the full repo gates are the orchestrator's run)

2026-10-21, implemented:

- `review.ts` `split()` no longer refuses a part that resolves to the food itself. It refuses only when two parts do (they would fold into one by `distinctFoods`, and which spelling is which is unknown). An unsure split is left whole as before.
- `splitByAI` (`ai-changes.ts`), under the tree lock and the foods' locks: the part whose `ingredientId` is the food reads its alias (`findCatalogueAliasOwner`), inserts a new food named for the alias's text, owned by the alias's owner, flagged `ai-queued` (`insertCatalogueIngredient` now takes `flagged`/`flagReason`), and moves the alias there with `moveCatalogueAlias` (the unmerge's own move: recipe lines, groceries and Pantry rows on that spelling follow it). Then `splitCatalogueIngredient` splits the rest as before, so the joined line names the new food and the other part, and the joined food goes. The new food is announced through `announceMinted`, so AI's pass reads it next (parent, Plain Name).
- Undo: a split is not an AI Change and has no Undo; neither has the moved spelling. Undoing it would mean a person moving the spelling back by hand (Spellings: move).
- Review fix (2026-10-21): a food already named for the spelling (a Plain Name can rename another food to it while the joined food keeps the spelling) gets the spelling instead of a new food, which would break the name index. `moveToFoodNamedFor` (`catalogue.ts`, shared with a person's "move to a new food", which still refuses `name-taken` there) locks the food of that name (`lockIngredientNamed`) or mints one, and moves the spelling. Test: "moves the spelling to the food already named for it".
- Edge cases (2026-10-21): where the joined food is itself named for the spelling, `splitByAI` returns `"refused"` and `split()` leaves the food whole, flagged `ai-unsure` (no line loses its food). Where the food named for the spelling is another part, the parts go through `distinctFoods` after the move, so no row gets that food twice; the "two parts spelled by the food itself" refusal is checked before, unchanged. Tests: "leaves it whole, flagged, when the food is itself named for the spelling", "names the food once where the food named for the spelling is another part".
- Test: `review.test.ts` "a joined food that holds one part's spelling" (the cream line and grocery follow the spelling to a new flagged food, the joined line names cream and yogurt as alternatives, the joined food is gone; unsure leaves it whole).
- Docs: a release-notes line and a sentence on the Ingredients page's split bullet.
- For ticket 31: on the production copy "light cooking cream or non-fat Greek yogurt" should now be split, its 4 "light cooking cream" lines on a new food light cooking cream (which then gets one more AI read).
