# 17: The panel's spoon weight in the household's measure

**What to build:** The Ingredient panel shows and corrects a density in the measure the household's recipes use for that food ("a teaspoon of cumin weighs 2 g"), instead of always a cup. It shows the row only when one of those recipes measures the Ingredient by volume. When no density is known, it asks for one, so "1 tl komijn" under "Not counted" is fixed in one step. The stored value stays a density; only the sentence around it changes.

**Blocked by:** None (can start immediately)

**Status:** done, pending gates and review

- [x] The spoon row appears only when a recipe the household can open has a line measuring this Ingredient by volume, under the same visibility the recipe list uses. Onion's panel has none unless such a recipe says "1 cup chopped onion".
- [x] The row states the weight of the volume measure those lines use most: "a teaspoon of cumin weighs 2 g", "a cup of flour weighs 125 g". Millilitre, centilitre, decilitre and litre lines read per 100 ml.
- [x] A correction is typed in that measure and stored as the same density. Corrections made before keep their value.
- [x] With no density known, the row asks for the weight in that measure.
- [x] The source under the row is unchanged: the dataset food, "chosen by Norish", borrowed from a parent, or the household's own.
- [x] The count of lines per measure comes through a repository, not a query in the router.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.

## Comments

- 2026-10-02, from the spoon-measures grill. The fixed cup (`CUP_ML` in `nutrition-copy.ts`) followed Mike's rule that a correction is asked in the words the user already sees. Spooned foods are where densities matter most, so the panel now takes those words from the household's own recipes.
- 2026-10-02, implemented.
  - `countIngredientLinesByUnit` (the nutrition repository) counts this Ingredient's lines by unit in the recipes the viewer can open, under the recipe list's view policy (`buildOwnerPolicyCondition`), and only in each recipe's own measurement system, as its worked-out total reads them: a converted US copy of a metric recipe never votes.
  - `spoonMeasureFor` turns those counts into a measure through `@norish/shared/lib/spoon-measure`: teaspoon, tablespoon or cup by their own sizes, every other volume per 100 ml. A tie goes to the smaller measure. It is served as its own query, `ingredients.spoonMeasure`, so the nutrition answer's shape is unchanged.
  - The spoon row reads "A teaspoon … 2 g" with the source beneath, like the piece row. With no density it reads "Norish has nothing for this yet" and offers "Add its weight", which opens the correction with the spoon's weight ready to type.
  - The correction panel shows the spoon only where the household's recipes measure the food by volume, or where its own correction already gives one (then per 100 ml when no recipe does). It types the weight in that measure and stores the same density. A density left as it was keeps the value it was stored with, so a cup typed before and shown now as "2.6" for a teaspoon does not drift on Save.
  - `onePieceLabel` was English in 13 locales; it now takes each locale's existing "one piece" wording.
  - Not done: the card's line opens the Ingredient panel, and the spoon row is two taps further (Nutrition, then Add its weight). Opening those nested panels straight from the card is possible if the extra taps prove too many.
