# 66: Near-duplicates stay although other names are given

**What to build:** Found by ticket 31's run after tickets 61-64 (2026-10-23, HEAD f7bdd8ae3, `m64_post_on`). Ticket 64's prompt line took other names from 46% to 94% of foods read, and 17 of last run's 37 near-duplicates merge again. But 5 own foods that last run merged, rightly, are own foods again: AI gave other names, and none is the spelling the catalogue holds (another cut word, a plural or singular, another spelling of a place name), so the lookup finds nothing and the food stays under its parent.

On the copy: 5 foods, 9 recipe lines. Near-duplicates in all: 25 of 398 listed own foods, against 37 of 417 last run and 12 of 388 in m54.

To decide: a lookup that finds a food by an other name that is close to a spelling but not equal to it, or near-duplicates left for a person to merge.

**Blocked by:** None

**Status:** wontfix

## Decided (Mike, 2026-10-23)

"Yes all three and then we have to accept". Build the family question: when AI's names find no food and a parent is found, ask the existing `ingredient-match` question over that parent and its listed children before filing the food under the parent. Evidence (scratchpad near-dup-cause.md): for 19 of m68's 30 near-duplicates the right food is the parent itself (8) or a child of it (11). Measured twice (ticket 31) against the noise band of m70a/m70b (crap 76/84, near-duplicates 34/37); it counts only if it moves clearly outside that band.

## Measured (2026-10-23)

Built (3e0ebd075) and taken out again. Ticket 31's m74a/m74b runs: near-duplicates fell from 34/37 to 16/12, but the family question merged a specific food into its general food 51/54 times a run (Maris Piper potatoes into potato, genoa salami into salami), flags went from 22/26 to 98/94, and requests from about 910 to 1505 a run. Counted as wrong, crap is 108/106 against 76/85.
