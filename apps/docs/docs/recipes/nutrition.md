---
sidebar_position: 4
title: Nutrition
description: How Norish works out calories, fat, carbohydrates and protein per serving from a recipe's own ingredients, where the numbers come from, and how your household corrects them.
---

# Nutrition

A recipe that states its nutrition shows exactly what it states. A recipe that
doesn't gets nutrition **worked out from its ingredients**: calories, fat,
carbohydrates and protein per serving, from open food datasets. This works on
every server, with or without [AI](../configuration/ai-provider.md).

![A recipe's nutrition worked out from its ingredients](/img/screenshots/recipe-nutrition-worked-out.png)

## How a recipe's total is worked out

Each line of the recipe is turned into grams and counted through the numbers
per 100 g of its [ingredient](../groceries/ingredients.md):

- A weight (“200 g onion”, “1 lb rice”) is used as it is.
- A count (“2 onions”, “3 cloves garlic”, “1 slice bread”) uses what one piece
  of that food weighs.
- A volume (“1 cup milk”, “2 tbsp olive oil”, “100 ml stock”) uses what a cup
  of that food weighs. Norish never assumes water: flour by the cup is not
  guessed.
- A pinch, a dash or “to taste” counts as nothing.

The total is divided by the recipe's servings, and changes as soon as you
change an amount. It is worked out each time you open the recipe, for your
household, and never stored on the recipe.

Under the total:

- **Not counted** names the lines Norish could not count: one with no amount
  (“olive oil for frying”), one in a unit that is no weight, count or volume
  (“1 can tomatoes”), or one for a food Norish has no numbers for. Each name
  opens that ingredient, where you can give it some.
- **Estimated** shows when a line used numbers borrowed from a more general
  food: a “red onion” Norish knows nothing specific about reads like an onion.
- The last line credits the datasets the total used.

A recipe whose every line is not counted shows no total at all rather than a
misleading zero.

### With AI

On a server with AI, [nutrition estimation](./enrichment.md) now fills only the
gaps: AI is given the lines Norish counted, with their numbers, and estimates
just the lines left out. Those lines are then listed as **Estimated by AI**
instead of not counted. When you change those lines the estimate no longer
applies; ask for a new one from the recipe's **⋯** menu. A recipe whose every
line counts asks AI nothing.

## Where the numbers come from

Each ingredient has its numbers per 100 g, what one piece weighs and what a cup
weighs, each with where it came from. Open **Settings → Ingredients** and an
ingredient's panel to see them.

![An ingredient's nutrition in its panel](/img/screenshots/ingredients-panel-nutrition.png)

Norish looks for each, in this order:

1. Your household's own correction.
2. A food Norish chose for it, where the dataset's usual pick is wrong for
   cooking: “milk” is whole milk, not skimmed, and “corn” is sweet corn, not
   dry grain (**chosen by Norish**).
3. The food the ingredient's [Open Food Facts](https://world.openfoodfacts.org)
   code names in CIQUAL, CALNUT or USDA FoodData Central.
4. A dataset food with the same name (**matched by name**).
5. The nearest more general food that has numbers: “red onion” borrows from
   “onion” (**from onion**), so filing a food under a [parent](../groceries/ingredients.md#the-ingredients-page)
   gives it numbers too. A few general foods never lend, because their children
   differ too much: an average sauce, pure alcohol, fruit.

The datasets are [CIQUAL 2025](https://ciqual.anses.fr) and CALNUT (ANSES),
[USDA FoodData Central](https://fdc.nal.usda.gov) and
[CoFID](https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid).
Every Norish release carries them, and the server applies a new version when it
starts. Nothing is fetched at runtime.

## Correcting nutrition for your household

If Norish's numbers don't match what you buy, press **Correct** in the
ingredient's panel. Anyone in your household can correct any ingredient, and the
correction counts for everyone in your household and nobody else. For each of
the numbers per 100 g, the weight of one piece and the weight of a cup, choose:

- **As Norish has it**,
- **A dataset food**: search the datasets by name, such as “milk semi-skimmed”,
- **From a label**: type the numbers from a pack.

![Correcting an ingredient's numbers from a label](/img/screenshots/ingredients-nutrition-correction.png)

The most recent correction in your household wins. **Remove our correction**
returns to the datasets' numbers. A more specific food that borrows from a
corrected one borrows your correction, so correcting “onion” fixes “red onion”
too. Corrections are your household's own data: a new release never changes
them, and the [catalogue download](../groceries/ingredients.md#data-sources)
never includes them.

[Ingredients](../groceries/ingredients.md) · [Enrichment](./enrichment.md) · [The recipe page](./recipe-page.md)
