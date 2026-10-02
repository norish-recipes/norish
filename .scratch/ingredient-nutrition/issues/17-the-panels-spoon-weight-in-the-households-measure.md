# 17: The panel's spoon weight in the household's measure

**What to build:** The Ingredient panel shows and corrects a density in the measure the household's recipes use for that food ("a teaspoon of cumin weighs 2 g"), instead of always a cup. It shows the row only when one of those recipes measures the Ingredient by volume. When no density is known, it asks for one, so "1 tl komijn" under "Not counted" is fixed in one step. The stored value stays a density; only the sentence around it changes.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The spoon row appears only when a recipe the household can open has a line measuring this Ingredient by volume, under the same visibility the recipe list uses. Onion's panel has none unless such a recipe says "1 cup chopped onion".
- [ ] The row states the weight of the volume measure those lines use most: "a teaspoon of cumin weighs 2 g", "a cup of flour weighs 125 g". Millilitre, centilitre, decilitre and litre lines read per 100 ml.
- [ ] A correction is typed in that measure and stored as the same density. Corrections made before keep their value.
- [ ] With no density known, the row asks for the weight in that measure.
- [ ] The source under the row is unchanged: the dataset food, "chosen by Norish", borrowed from a parent, or the household's own.
- [ ] The count of lines per measure comes through a repository, not a query in the router.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.

## Comments

- 2026-10-02, from the spoon-measures grill. The fixed cup (`CUP_ML` in `nutrition-copy.ts`) followed Mike's rule that a correction is asked in the words the user already sees. Spooned foods are where densities matter most, so the panel now takes those words from the household's own recipes.
