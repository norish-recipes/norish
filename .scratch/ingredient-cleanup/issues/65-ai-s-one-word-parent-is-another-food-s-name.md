# 65: AI's one-word parent is another food's name

**What to build:** Found by ticket 31's run after tickets 61-64 (2026-10-23, HEAD f7bdd8ae3, `m64_post_on`). AI read a fresh vegetable rightly and gave a one-word parent that, in the catalogue, is the name of a spice. The parent lookup matches a food's own name first (ticket 32), so the vegetable is filed under the spice, sure. Last run AI gave the specific vegetable parent and the food sat right; m56 had the same reading once.

On the copy: 1 food, 4 recipe lines.

To decide: does a parent AI gives that names a food of another kind (a spice for a vegetable) get a second look, or is the word left to the prompt?

**Blocked by:** None

**Status:** done

## Decided (Mike, 2026-10-23)

"build all except 66". Specific before general: on 0.25 the food was under red bell pepper, and AI swapped that for "pepper". When the parent AI gives is the last word (or words) of the current parent's name, the food keeps the current, more specific parent. No extra AI call.

## Implemented (2026-10-23)

- In `readThenLookUp` (`ai/resolution/ingredient-resolution.ts`) a parent AI gives that is the last word(s) of the current parent's name, compared on `foldName` with a leading space (`" red bell pepper".endsWith(" pepper")`, equality included), is the current parent: it is not looked up, the category is not looked up either, and ticket 56's "never merged into its parent" check compares against the current parent.
- `AskOptions.filedUnder` is now `{ id, name } | null`: `askAIAbout` (`ingredients/review.ts`) passes the row it already loads; the reading still gets only the name as `Parent:`.
- Test: `review.test.ts` "keeps the parent when AI names it in fewer words, though another food has those words" (red pointed peppers, pepper vs red bell pepper). Release-notes line on the parent rule (line with "chocolate whey") and an ADR-0037 amendment.
- Side effect for ticket 52: a steak food under beef steak whose AI parent is "steak" now keeps beef steak without the lookup reaching patty's French "steak".
