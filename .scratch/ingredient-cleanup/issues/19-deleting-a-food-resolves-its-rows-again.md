# 19: Deleting a food resolves its rows again

**What to build:** Deleting a food resolves each recipe line, Grocery and recurring grocery that pointed at it again from its own text, with AI off and minting nothing. Today they all point at no food. Without the deleted food blocking the whole match, the words can split a line:

- "zout en peper" and "salt and pepper", merged into a "kruidenmix" that is then deleted, point at zout + peper;
- a text another food knows whole points at that food;
- everything else ("kruidenmix" itself) points at no food, so a delete still never mints the food back.

Pantry Ingredients are still deleted, since they have no text. The resolving is the first-start cleanup's step 3 (`resolveAgain` in `first-start-cleanup.ts`), moved into the catalogue so both use it, with a resolver option that leaves no food where it would mint.

The nightly sweep needs nothing: what it deletes names nothing.

**Blocked by:** 02, 09

**Status:** done

- [x] Deleting a food whose translations are "zout en peper" and "salt and pepper" points those lines and groceries at zout + peper. A "kruidenmix" line points at no food, and no food is minted.
- [x] A line whose text another food knows whole points at that food after the delete.
- [x] The delete dialog's counts still say what the delete touches.
- [ ] All `CONTRIBUTING.md` gates pass.

## Comments

2026-10-21, implemented:

- `resolveAgain` lives in `catalogue.ts` now, with `mint`: the delete passes false, the first-start cleanup true. The resolver's `mint: false` stops after rungs 1 and 2 and the joining words: no slip is joined either, since a slip adds the text as a spelling of another food.
- A Grocery or recurring grocery of "zout en peper" becomes one per food, "zout" and "peper", as a typed one does (ticket 05), and "boter of olie" its first. AI's split writes groceries through the same `writeGroceryParts`. The cleanup's step 3 now splits groceries this way too.
- A row whose text names nothing known keeps what the delete left it: a line "zout en kruidenmix" keeps zout.
- The delete dialog's copy ("keep their text without it") still holds, so it is unchanged.
- ADR-0037 and the Ingredient glossary entry are amended, and the Ingredients docs page and the release notes say what a delete now does.
- After the review, the change is announced even where resolving again fails, since the delete has gone through. A grocery renamed between the read and the write is left alone (`writeGroceryParts` writes only where the name is still the one read).
- The dialog's "keep their text without it" is loose in one case: a "zout en peper" grocery becomes a "zout" and a "peper" grocery. The counts still hold. The copy is unchanged in every locale, for Mike to decide.
