# 34: A colon line on a clean spelling keeps its food

**What to build:** Found by ticket 31. After the first start, 1 recipe line ending in a colon still names a food, so ticket 30's "colon line, with a food" row is 1, not 0. The other 10 colon lines pointed at their own colon spelling ("Voor de salade:"), which the cleanup now removes. This one, "Peri peri kruiden:", points at the clean spelling "peri peri kruiden", which other lines also use: the cleanup never removes it, so the line is never resolved again.

- On the production copy: 1 of 11 colon lines.
- Mike, 2026-10-22: the cleanup also looks at lines: a line whose own text names no food (`lineNamesNoFood`) but names a food loses it, as a fresh import gives it none. The line keeps its text.

**Blocked by:** None

**Status:** done

- [x] After the first start, no line ending in a colon names a food.

## Implemented (2026-10-22)

- `first-start-cleanup.ts` step 4 (new, after the spelling removal): `findLinesNamingAFood()` (repo `ingredient-cleanup.ts`, the lines query `findNamingRows` shares) reads every line naming a food; those `lineNamesNoFood({ text, amount })` says name none go through `resolveAgain(…, { mint: false })`, which gives them no food. Outcome field `cleared`. `CLEANUP_VERSION` is 3.
- A food no line names any more is left as is: hidden, and the 90-day sweep removes it if nothing else names it. "peri peri kruiden" stays, other lines name it.
- Test: `first-start-cleanup.test.ts`, "takes the food from a line naming none, though it names a clean spelling; the line keeps its text".
- No release-notes change: line 87 ("Voor de salade:" names no food) now holds for this case too.
- The same release also clears flags on hidden foods (step 6, see ticket 25's note), so the outcome has `unflagged` too.
