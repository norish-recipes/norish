# 80: A slip of two letters is another food

**What to build:** Found by an AI-off import of Mike's library into a fresh 0.26 instance (2026-10-26, HEAD c26ffb666). The slip rule (`name-slips.ts`) allows two letter errors, up to a quarter of the name, so 15 texts joined other foods, often through another language's seed spelling: "wraps" to rapeseed (Danish "raps"), "plain flour" to lupin flour, "visfilet" to chicken fillet, "witte ui" to white fish, "trassi" to fat (Italian "grassi"), "uncooked rice" to cooked rice, "cooked bacon" to smoked bacon, "amandelmelk" into "amandelmeel", "visbouillon" into "kipbouillon", and "Salt & pepper" to black pepper through Swedish "svart pepper". The last one then caught every later "Salt & pepper" line before the and-split ran, so those lines lost their salt.

On the import: 15 foods, ~45 recipe lines.

**Blocked by:** None

**Status:** done

## Decided (Mike, 2026-10-26)

A slip is one letter wrong, left out or added, or two neighbours swapped, and never the first letter, from five letters up. One rule for the recipe resolver and the grocery product auto-link (released in 0.25).

## Implemented (2026-10-26)

- `name-slips.ts` checks one slip directly (`oneSlipApart`) instead of scoring with Fuse; `fuse.js` leaves `@norish/shared`. A name may be one character longer or shorter (`LENGTH_SLACK` 1), which narrows `findAliasesNearFold`'s band. Every slip scores `1 - 1/length`, so exact names still score 1 and ties still give no answer.
- The foods AI is shown at the second question come from the same rule, so they are now a letter apart.
- Tests: `name-slips.test.ts` tables the measured pairs both ways; `auto-link.test.ts`, `resolver-ai.test.ts` and `review.test.ts` moved their two-letter fixtures to one-letter ones ("parmesaan", "agaragar", fennel/funnel), and "barmezaan" now mints its own food.
- Docs: CONTEXT.md (Alias), ADR-0037 and ADR-0028 amendments, release notes (new line for the slip rule and the stricter auto-link), the Ingredients page, the Ingredient match prompt's description in every locale, and the pt-BR docs.
- No repair pass: the resolver's slip rung is new in 0.26, so only dev data holds wrong slip joins. Grocery product links already made stay.
