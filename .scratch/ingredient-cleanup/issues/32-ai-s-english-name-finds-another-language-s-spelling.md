# 32: AI's English name finds a food by another language's spelling

**What to build:** Found by ticket 31. With AI on, the pass filed "Hero Bosvruchtenjam" under yam, as a sure parent. AI's parent was "jam". The catalogue has a seeded food named jam, but the spelling "jam" was yam's (Croatian, `hr`), and an exact spelling of AI's names is taken without a second question (ticket 26).

Mike's call (2026-10-22): "how is this even possible? A food called jam doesn't have the spelling jam? We should match based on food as well that should even be more important probably..."

- Find out why the food jam does not hold the spelling jam.
- Where AI's names are looked up, a food whose own name is the text is the match, before another food's spelling.
- Fix the seed where the cause is a seed rule and the fix is small; else describe it for Mike.

**Blocked by:** None

**Status:** done

- [x] "Hero Bosvruchtenjam" is not filed under yam.
- [x] AI's parent jam files under the food jam, not yam (whose hr spelling is jam).
- [x] The seed gives the spelling jam to jam, on a new instance and once on a seeded one.

## Implemented (2026-10-22)

**The cause.** Spellings are unique by fold, and `applyIngredientSeed` (`packages/db/src/repositories/ingredient-seed.ts`) gives a fold shared by two entries to the entry that comes first in the file ("Every spelling, first claim first"). In Open Food Facts' `ingredients.txt`, `en:yam` (line ~61,229, with `hr: jam`) comes long before `en:jam` (line ~102,645, `en: jam, confiture`). So yam's Croatian spelling took the fold, and jam's own English name was logged as an alias collision and dropped. The entry's name plays no part in who wins.

On `m31_post_on`, 25 seeded foods have a name whose fold another food holds as a spelling. Among them: pea (pear, `mi`), grape (grapefruit, `da`), raisin (grape, `fr`), lard (bacon, `fr`), prune (plum, `fr`), salad (lettuce, `ms`), salsa (parsley, `pt`), champignon (mushroom, `fr`) and paprika (bell pepper, `hr`). Some are English beside English (apples on apple, Napa cabbage on Chinese cabbage, runner bean on flat bean). Only three have rows: paprika 30 recipe lines and 1 grocery, salsa 4 lines, apples 4 lines.

**What changed.**

- `findOtherFoodsNamed` (`packages/shared-server/src/ingredients/resolver.ts`) looks up the foods whose name is the text first (`findIngredientsNamed` in `packages/db/src/repositories/ingredient-aliases.ts`: `lower(name)` against the text's fold and lowercased clean text, then compared by `ingredientAliasFold(name)`), and only then the spellings (rungs 1–2) and slips. A food found by its name scores `EXACT`. One exception: a spelling the asked food itself holds stays its own, so a split still moves that spelling to the food named for it (`moveToFoodNamedFor`). Without it, two split tests in `review.test.ts` lost the spelling. Every path through `findNamed` gets the rule (AI's English name, other names, parent, split parts), and so does `recheckUndecidedMints`.
- Seed: `SPELLING_MOVES` gains `en:yam → en:jam ["jam"]`, `SEED_CORRECTIONS_VERSION` 2. Each file read gives jam its spelling, and `correctSeedOnce` moves the seeded row (with its rows, none on the copy) once on an instance seeded before. I checked it against the live OFF file: after `seedEntriesOf`, yam keeps "yam" and jam holds "jam".
- Tests: `review.test.ts` "AI's parent jam files under the food jam, not yam (whose hr spelling is jam)" (seed state from before the fix, parent sure, one request); `catalogue-seed.test.ts` "gives jam to the food jam, though yam's Croatian spelling comes first in the file". Both were red first.
- Release notes line under Fixes in 0.26.0-beta.

**Not changed, for Mike.**

- **The import resolver keeps reading spellings only**, so no `RUNG_VERSION` bump. With the name first at import, a Dutch recipe's "paprika" (bell pepper in Dutch, found today only through the Croatian spelling) would become the spice paprika: 30 lines on the copy. AI's names are English, where the name is right. If you want an import to also prefer the name, it is the same guard in `resolveTexts`, plus a bump.
- **No general seed rule for "an entry's own name owns its fold".** It is about ten lines in `applyIngredientSeed` plus a correction for seeded instances, but on the copy it would move those 30 Dutch paprika lines and the grocery to the spice, and the salsa and apples lines too. I moved only jam, which no line names and which means jam in Dutch as well. Want the general rule? List the folds to leave out (paprika at least), or accept the moves.
- The recheck of old mints gets the name rule but no `RUNG_VERSION` bump: it only matters for a mint holding a spelling that another food is named, which the seed's adoption by name almost rules out.
