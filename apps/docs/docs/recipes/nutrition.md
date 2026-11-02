---
sidebar_position: 4
title: Nutrition
description: Calories and macros per serving, worked out from the ingredients.
---

# Nutrition

Calories, protein, fat and carbs are shown per serving. When the source
doesn't provide them, they are calculated from the ingredients. This works with
or without [AI](../configuration/ai-provider.md).

![A recipe's nutrition worked out from its ingredients](/img/screenshots/recipe-nutrition-worked-out.png)

## How lines are counted

Each ingredient line is converted to grams using the
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

## Fiber, sugars, sodium and more

The card lists saturates under fat and sugars under carbs, the way food labels
do, when Norish knows them. Fiber and sodium are under **More nutrients**. The
ring stays fat, carbs and protein.

Each one comes from the recipe when its source states it. Otherwise Norish adds
it up from the ingredients, with the [AI](../configuration/ai-provider.md)
estimate for the lines it couldn't count. Not every food in the datasets has
every value, so a total that only some of the counted lines add to is marked
with **\***: it may be higher. Where that total rounds to 0, the card shows
**—** instead.

Norish also keeps mono- and polyunsaturated fat, trans fat, cholesterol,
potassium, calcium, iron, vitamin C and vitamin A where the datasets have
them. The API returns them all.

## Where the numbers come from

Open **Settings => Ingredients** and pick an ingredient to see its values per
100 g, the weight of one piece and the weight of a spoon.

![An ingredient's nutrition in its panel](/img/screenshots/ingredients-panel-nutrition.png)

Values come from the first available source below:

1. Your household's correction.
2. A curated food match where the usual match is wrong for cooking, like
   whole milk for "milk". Marked **chosen by Norish**.
3. The food that the ingredient's [Open Food Facts](https://world.openfoodfacts.org)
   entry points to.
4. A dataset food with the same name. Marked **matched by name**.
5. AI's estimate, where an administrator lets AI
   [fill missing nutrition](../configuration/ai-provider.md#ingredient-catalogue).
   Marked **Estimated by AI**.
6. A more general food: "red onion" uses "onion". Marked **from onion**. An ingredient can inherit values from its
   [parent](../groceries/ingredients.md#matching). Sauces, pure alcohol and fruit don't pass
   their values on, because their kinds differ too much.

The datasets are [CIQUAL 2025](https://ciqual.anses.fr) and CALNUT (ANSES),
[USDA FoodData Central](https://fdc.nal.usda.gov) and
[CoFID](https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid).

## Correcting nutrition

To correct values for what you buy, open **Nutrition** in the ingredient's
panel and press **Correct**. Anyone in your household can correct any
ingredient; corrections are visible only to your household.

For the values per 100 g, the weight of one piece and the weight of a spoon,
pick one:

- **No correction**: keep the supplied values.
- **A dataset food**: search the datasets, like "milk semi-skimmed".
- **From a label**: type the numbers from the pack.

![Correcting what a teaspoon of cumin weighs, from a label](/img/screenshots/ingredients-nutrition-correction.png)

## Reading nutrition from the API

Apps that read recipes through the [REST API](../reference/api.mdx), like a
calorie tracker, get the same numbers per serving from
`GET /api/v1/recipes/{id}/nutrition`. The answer says where the numbers come
from: `supplied` when the recipe states them, `worked-out` when Norish works
them out from the ingredients for your household, or `none`. A worked-out
answer also lists the lines it left out and why, and says when it is
estimated. The other nutrients are in `perServing.extras`, with
`extrasCoverage` saying which share of the counted lines, by weight, each one
covers.
