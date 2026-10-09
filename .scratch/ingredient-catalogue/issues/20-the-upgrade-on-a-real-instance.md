# 20: The upgrade on a real instance

**What to build:** On 2026-10-02 Mike ran this release against a copy of his production database (421 recipes, 6,150 lines, 3,826 ingredients) and the catalogue came out unusable:

- 116 `#` headings had become Ingredients. The seed adopted 11 of them, so rice, chicken and sauce were named "# Rice", "# CHICKEN" and "# Sauce", and 37 foods were filed under "# Sauce".
- 2,189 old line texts stayed unflagged foods with no parent ("kleine courgette, in kleine blokjes", "(2.5g) - Ground Cumin"). The seed's merge pass only flagged ambiguous names, and the recheck only reads flagged ones.
- The seed's own spellings of the commonest words were skipped, because the old rows had claimed those folds first ("knoflook", "gember", "basilicum"). Filing by words could not see them.

The fix is Mike's ordering: **seed first, then resolve the existing data through the resolver**, as a new import with AI off would.

**Blocked by:** None (can start immediately)

**Status:** done, pending review

- [x] The first boot seeds the catalogue before the upgrade backfill.
- [x] The backfill resolves every reference's text (recipe line, pantry row, grocery, recurring grocery, link) through the resolver with AI off. An old `ingredients` row is no longer carried over as a food:
  - a row whose name is exactly a seed entry's is adopted by the seed;
  - every other row is removed once nothing points at it.
- [x] Unknown texts mint as the resolver mints: flagged `upgrade`, named for their plain name, filed under the food their words name.
- [x] A `#` heading names no food: it is never resolved, on save or in the upgrade, and keeps no alias.
- [x] An adopted Ingredient takes its seed entry's name and is no longer flagged.
- [x] Filing by words reads every spelling of a seeded food, not only the spellings the seed added.
- [x] Filing by words looks only before "in", "met" or "with" ("tonijnstukken in olijfolie" is no olive oil).
- [x] Filing by words reads a plural the words end with as its singular, the whole text included, without merging the two.
- [x] A plain name drops punctuation at its edges ("- Fresh Salmon" is "Fresh Salmon").
- [x] A seed that arrives after the upgrade (an offline first boot) is followed by the recheck, so its mints are filed against it.
- [x] Measured against the production copy, before and after.
- [x] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.

## Comments

- 2026-10-02, diagnosis. The first run's log is `.runtime/prod-copy/dev-server.first-run.log`. Recipe pages failed for a different reason: the copy's user names are encrypted with the production MASTER_KEY.
- 2026-10-02, Mike's calls:
  - Every unclaimed name is flagged, so the review queue on his copy is about 1,900.
  - Seed first, then merge the existing data.
  - The earlier proposal is superseded. It kept old rows as foods, flagged them and relied on the recheck.
- 2026-10-02, implemented.
  - Boot order in `apps/web/server/index.ts`: seed, then `backfillIngredientAliases`, then the recheck.
  - The backfill no longer gives old rows their own name (`addOwnNameAliases`, `mergeSpellingless` and `listIngredientsWithoutAlias` are gone). It resolves every reference, keys the legacy links, then calls `removeIngredientsWithoutSpelling`, which only an old row can match, since every Ingredient made since keeps a spelling.
  - A mint whose name an old row holds takes that row over, flag and parent included (`mintIngredientWithAliases`). Without that, "Olive Oil" joined the old "Olive Oil" row unflagged, and every old name that was already plain would have stayed an undecided food.
  - Headings: `isIngredientHeading` (`@norish/shared/lib/ingredient-headings`). `resolvedRecipeLineValues` writes a heading with no alias, `withResolvedIngredients` never sends one to the resolver, and `listRecipeLinesWithoutAlias` never lists one.
  - Adoption sets the entry's name unless another Ingredient holds it, clears the flag, and drops a `words` suggestion.
  - `findSeededFoodSpellingsByFolds` replaces `findSeededAliasesByFolds`: any spelling of an Ingredient with an `off_id`.
  - `parentFromWords` reads only the words before "in", "met" or "with", and those may name the parent whole.
  - The first seed sets `rungVersion: 0`. The scheduled refresh task runs `recheckUndecidedMintsOnRungChange` after an applied refresh, so it is a no-op unless the rung version is stale.
- 2026-10-02, added after the first replay: `NEVER_A_FOOD`, a fixed English and Dutch list of words that never name the parent alone. Of 1,116 filings, 164 came through a one-word spelling in another language. Most were right ("banaan" is Estonian too), but "and" is Danish for duck, "more" Italian for blackberries, "cal" Romanian for horse and "a" Walloon for garlic: "frozen peas and carrots" went under duck.
- 2026-10-02, measured. The real boot steps ran against a pristine copy of the production data (`.runtime/analysis/replay-upgrade.ts`), next to the first run:

  |                                       | first run | fixed |
  | ------------------------------------- | --------- | ----- |
  | Ingredients                           | 8,109     | 7,260 |
  | `#` headings as foods                 | 116       | 0     |
  | names starting "("                    | 66        | 3     |
  | names with a comma                    | 258       | 2     |
  | unseeded with no parent               | 2,386     | 443   |
  | old spellings sitting on seeded foods | 1,412     | 0     |
  | flagged                               | 117       | 1,559 |
  - The upgrade's boot steps take about 26 s: seed 4 s, backfill 11 s, a recheck that finds nothing new 10 s.

- Open, reported to Mike, not done:
  - Lines whose amount stayed in the text: "120 g tahini" and "150 GR CHERRYTOMATEN" (read as 150 tomatoes).
  - Product names ending in a flavour still file under it: "afbak focaccia's rozemarijn zeezout" goes under sea salt.
  - Punctuation-only and broken names (")", "[object Object]") are flagged mints.
- 2026-10-02, Mike approved filing plurals under their singular (identity unchanged: the plural stays a flagged food of its own, merging stays AI's, the Decision's or a person's).
  - `singularReadings` reads the last word through English and Dutch plural endings (ies→y, oes→o, ves→f, es, s, eren, en) and a Dutch "avocado's", which folds to "avocado s".
  - Within a length, the words as written come first and the singular after them. Otherwise "dried guajillo peppers" went under the peppercorn instead of guajillo, as the first replay showed.
  - "peppers" and "green peppers" alone still land on the peppercorn, Open Food Facts' "pepper", as Mike accepted. Counted by piece they weigh about 0 g.
  - Replayed: 39 fewer unplaced mints (443 → 404); "carrots", "avocados", "bell peppers", "limoenen" and "pita's" are filed under their singular.
- 2026-10-02, partly superseded by 21:
  - `NEVER_A_FOOD` and the plural endings are now per-language ingredient words that an administrator can edit.
  - Plurals and diminutives match as the food itself.
  - `ingredient-headings` became `ingredient-text`, where `namesNoFood` also covers ")" and "[object Object]".
