---
sidebar_position: 4
title: Nutrition
description: Macros in norish
---

# Nutrition

If enough data is available norish shows the protein, fats, carbs and calories of a recipe.
When the source does not state it the macros are worked out from the ingredients.
This works on every server, with or without [AI](../configuration/ai-provider.md).

![A recipe's nutrition worked out from its ingredients](/img/screenshots/recipe-nutrition-worked-out.png)

## How it works

Each line of the recipe is turned into grams and counted through the numbers
per 100 g of its [ingredient](../groceries/ingredients.md):

- A weight (“200 g onion”, “1 lb rice”) is used as is.
- A count (“2 onions”, “2 large eggs”, “3 cloves garlic”, “1 slice bread”) uses the average
  a piece weighs
- A volume (“1 tsp cumin”, “2 tbsp olive oil”, “1 cup milk”, “100 ml stock”)
  uses its spoon weighs settable in the ingredient panel
- When the weight is stated in brackets that is used:
  “1 (15 ounce) can coconut milk”, “1 can (400 g) tomatoes”, “1 tsp (3 g) paprika”.
- A pinch, a dash or “to taste” is seasoning and never counted.

The nutrition card always shows what is counted and what isn't with the reasoning.

A teaspoon is 5 ml, a tablespoon 15 ml and a cup 240 ml.

The total is divided by the recipe's servings to get a per portion estimate.

## The data

Each ingredient has its numbers per 100 g, what one piece weighs and what a
spoon of it weighs. Open **Settings => Ingredients** and click an ingredient to see the data.

![An ingredient's nutrition in its panel](/img/screenshots/ingredients-panel-nutrition.png)

The order

1. Your (household's) correction.
2. A food Norish chose for it, where the dataset's usual pick is wrong for
   cooking: “milk” is whole milk, not skimmed, and “corn” is sweet corn, not
   dry grain. Marked with: **chosen by Norish**.
3. The food the ingredient's [Open Food Facts](https://world.openfoodfacts.org)
   code names in CIQUAL, CALNUT or USDA FoodData Central.
4. A dataset food with the same name. Marked with: **matched by name**.
5. The nearest more general food that has numbers: “red onion” borrows from
   “onion”. Marked with: **from onion**, so filing a food under a [parent](../groceries/ingredients.md#where-the-catalogue-comes-from)
   gives it nutritional values as well. A few general foods never lend their numbers, because
   their children differ too much such as: sauces, pure alcohol and fruit.

### The datasets

The datasets are [CIQUAL 2025](https://ciqual.anses.fr) and CALNUT (ANSES),
[USDA FoodData Central](https://fdc.nal.usda.gov) and
[CoFID](https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid).

## Correcting nutrition

If Norish's numbers don't match what you buy, open **Nutrition** in the
ingredient's panel and press **Correct**. Anyone in your household can correct
any ingredient, and corrections are scoped to your household: nobody else sees
them. Each fact says what Norish has for it now. For each of the numbers per
100 g, the weight of one piece and the weight of a spoon (in the measure your
recipes use for it), choose:

- **No correction**: keep Norish's numbers,
- **A dataset food**: search the datasets by name, such as “milk semi-skimmed”,
- **From a label**: type the numbers from a pack.

![Correcting what a teaspoon of cumin weighs, from a label](/img/screenshots/ingredients-nutrition-correction.png)
