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
- A count (“2 onions”, “2 large eggs”, “3 cloves garlic”, “1 slice bread”) uses
  what one piece of that food weighs. A kind weighs its own size: an egg yolk
  is no whole egg, and a cherry tomato no tomato.
- A volume (“1 tsp cumin”, “2 tbsp olive oil”, “1 cup milk”, “100 ml stock”)
  uses its [spoon weight](#spoon-weights): what a teaspoon, tablespoon or cup
  of that food weighs. Norish never assumes water: flour by the cup is not
  guessed.
- A line none of those weigh uses the weight it states in brackets, as many
  recipes write it: “1 (15 ounce) can coconut milk”, “1 can (400 g)
  tomatoes”, “1 tsp (3 g) paprika”.
- A unit an older import left at the start of a line's text (“150 GR
  cherrytomaten”, kept as 150 of “GR cherrytomaten”) is read as the line's
  unit.
- A pinch, a dash or “to taste” is seasoning: never counted, but named with the
  lines left out.

A teaspoon is 5 ml, a tablespoon 15 ml and a cup 240 ml, whatever language the
recipe was written in. The American “T” is a tablespoon and “t” a teaspoon,
the Dutch “eetl” and “theel” are a tablespoon and a teaspoon too, “stuk” and
“Stück” are pieces, and the British “heaped tsp” is a heaping
teaspoon.

The total is divided by the recipe's servings, and changes as soon as you
change an amount. It is worked out each time you open the recipe, for your
household, and never stored on the recipe.

Under the total:

- An asterisk after the calories means some lines were left out. **3 lines not
  counted** beneath the numbers opens the list right there, each line with why:
  seasoning, no amount (“olive oil for frying”), a measure with no set weight
  (“1 can tomatoes”, “a handful of spinach”), or a food that has no numbers yet,
  or no spoon or piece weight yet. A line whose fix is one of those facts opens
  its ingredient's panel, where you can give it.
- **Estimated** shows when the lines that used a fact borrowed from a more
  general food bring at least a tenth of the calories: three red onions Norish
  knows nothing specific about read like onions, but one teaspoon of paprika
  borrowing a spice's spoon weight leaves a curry counted.
- The last line credits the datasets the total used.

A recipe whose every line is left out shows no total at all rather than a
misleading zero.

### With AI

On a server with AI, [nutrition estimation](./enrichment.md) now fills only the
gaps: AI is given the lines Norish counted, with their numbers, and estimates
just the lines left out, each on its own; seasoning is never sent. Those lines
stay in the list under the total, marked **estimated by AI**. A line your
household's correction counts uses your numbers and the other lines keep AI's.
When you change one of those lines its estimate no longer applies and it is
listed as not counted until the next run; ask for one from the recipe's **⋯**
menu. A recipe whose every line counts asks AI nothing.

## Where the numbers come from

Each ingredient has its numbers per 100 g, what one piece weighs and what a
spoon of it weighs, each with where it came from. Open **Settings →
Ingredients** and an ingredient's panel to see them.

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
   gives it numbers too. A few general foods never lend their numbers, because
   their children differ too much: an average sauce, pure alcohol, fruit.

### Spoon weights

A spoon or cup line goes through the food's spoon weight. USDA weighed a spoon
or a cup of thousands of foods, but CIQUAL weighs none, so for a food whose
numbers come from CIQUAL Norish takes the weight USDA measured for the same food:
cumin reads CIQUAL's numbers and USDA's teaspoon (**Spices, cumin seed · USDA
FoodData Central, chosen by Norish**). Butter, breadcrumbs, soy sauce, mustard,
vinegar, rice and a few dozen other often-spooned foods are chosen this way, in
the list that comes with every release.

A few groups whose foods share a form carry one spoon weight for all their
kinds: spices, sauces, syrups, vinegars and creams, so garam masala weighs like
a spice, golden syrup like a syrup and double cream like cream. A sauce borrows
the sauce's spoon weight even though a sauce never lends its calories: what a
spoonful weighs is the same, what's in it is not. Cheese, herbs, fruit,
vegetables and meat share no spoon weight, and nor does dairy as a whole, since
a cup of grated cheese weighs nothing like a cup of milk.

An ingredient's panel shows its spoon weight only where one of the recipes you
can open measures it by volume, in the measure those recipes use most: “A
teaspoon · 2 g” for cumin, “A cup · 125 g” for flour, and per 100 ml where they
use millilitres or litres. Onion's panel says nothing about cups of onion until
a recipe asks for one. Where Norish doesn't know it, the row asks: **Add its
weight** opens the correction ready to type what that spoon weighs.

![An ingredient's panel asking what a cup of it weighs](/img/screenshots/ingredients-nutrition-spoon.png)

### The datasets

The datasets are [CIQUAL 2025](https://ciqual.anses.fr) and CALNUT (ANSES),
[USDA FoodData Central](https://fdc.nal.usda.gov) and
[CoFID](https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid).
Every Norish release carries them, and the server applies a new version when it
starts. Nothing is fetched at runtime.

## Correcting nutrition for your household

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

The most recent correction in your household wins. **Remove our correction**
returns to the datasets' numbers. A more specific food that borrows from a
corrected one borrows your correction, so correcting “onion” fixes “red onion”
too. Corrections are your household's own data: a new release never changes
them, and the [catalogue download](../groceries/ingredients.md#data-sources)
never includes them.

[Ingredients](../groceries/ingredients.md) · [Enrichment](./enrichment.md) · [The recipe page](./recipe-page.md)
