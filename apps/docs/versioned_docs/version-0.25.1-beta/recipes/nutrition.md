---
sidebar_position: 4
title: Nutrition
description: Calories and macros per serving, worked out from the ingredients.
---

# Nutrition

Norish shows calories, protein, fat and carbs per serving. When the source
doesn't state them, Norish works them out from the ingredients. This works with
or without [AI](../configuration/ai-provider.md).

![A recipe's nutrition worked out from its ingredients](/img/screenshots/recipe-nutrition-worked-out.png)

## How lines are counted

Norish turns each ingredient line into grams and uses the
[ingredient's](../groceries/ingredients.md) values per 100 g.

- A weight, like `200 g onion` or `1 lb rice`, is used as is.
- A count, like `2 eggs` or `3 cloves garlic`, uses the weight of one piece.
- A volume, like `2 tbsp olive oil` or `1 cup milk`, uses the weight of a spoon
  of that ingredient. A teaspoon is 5 ml, a tablespoon 15 ml and a cup 240 ml.
- A weight in brackets wins: `1 (15 ounce) can coconut milk`,
  `1 can (400 g) tomatoes`.
- A pinch, a dash or "to taste" is not counted.

The total is divided by the servings. The nutrition card lists which lines were
counted and why the others weren't.

## Where the numbers come from

Open **Settings => Ingredients** and pick an ingredient to see its values per
100 g, the weight of one piece and the weight of a spoon.

![An ingredient's nutrition in its panel](/img/screenshots/ingredients-panel-nutrition.png)

Norish uses the first of these that has numbers:

1. Your household's correction.
2. A food Norish picked because the usual match is wrong for cooking, like
   whole milk for "milk". Marked **chosen by Norish**.
3. The food that the ingredient's [Open Food Facts](https://world.openfoodfacts.org)
   entry points to.
4. A dataset food with the same name. Marked **matched by name**.
5. A more general food: "red onion" uses "onion". Marked **from onion**. Filing
   an ingredient under a [parent](../groceries/ingredients.md#catalogue-source)
   gives it the parent's values. Sauces, pure alcohol and fruit don't pass
   their values on, because their kinds differ too much.

The datasets are [CIQUAL 2025](https://ciqual.anses.fr) and CALNUT (ANSES),
[USDA FoodData Central](https://fdc.nal.usda.gov) and
[CoFID](https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid).

## Correcting nutrition

If the numbers don't match what you buy, open **Nutrition** in the ingredient's
panel and press **Correct**. Anyone in your household can correct any
ingredient, and only your household sees the correction.

For the values per 100 g, the weight of one piece and the weight of a spoon,
pick one:

- **No correction**: keep Norish's numbers.
- **A dataset food**: search the datasets, like "milk semi-skimmed".
- **From a label**: type the numbers from the pack.

![Correcting what a teaspoon of cumin weighs, from a label](/img/screenshots/ingredients-nutrition-correction.png)
