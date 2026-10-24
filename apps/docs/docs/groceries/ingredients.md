---
sidebar_position: 4
title: Ingredients
description: The food catalogue behind aisles, prices, the pantry and nutrition.
---

# Ingredients

Norish keeps a catalogue of **ingredients** for the whole server. Each
ingredient is one food, with its names in other languages and its nutrition
when known. So:

- an [aisle](./aisles.md) set for "onion" also works for "onions" and "ui"
- a [product](./prices.md) linked to "milk" also works for "melk"
- "onion" in the [pantry](./pantry.md) also covers its translations

Find it under **Settings => Ingredients**. The page lists every ingredient from
the catalogue source and every one a recipe uses. One only groceries or the
pantry use, like "toilet paper", is not listed, and keeps its aisle and price.
It is listed once a recipe uses it.

## Catalogue source

Norish starts from the [Open Food Facts](https://world.openfoodfacts.org)
ingredients list and refreshes it every night.

A new name from a recipe, grocery or pantry is matched to an existing
ingredient, ignoring plurals, amounts, units, preparation and stray marks.
"finely chopped onions" matches "onion", "4 el bosui" matches "bosui",
"gyoza vellen ((ontdooid))" matches "gyoza vellen", and the slip "barmezaan"
matches "parmezaan". A name that joins foods names each of them: "zout en
peper" is salt and pepper, and "boter of olie" is butter or oil. A name nothing
matches becomes a new ingredient, under its clean name.

Norish also keeps a list of texts that are not a food: what AI deleted as one,
what you marked as one, and common words like "to taste", "boneless" or
"rolling pin" in every language Norish speaks. A recipe line that says only
such a text names no food. One that starts with it, like "boneless, skinless
chicken breasts", is read on the rest. Adding the text as a translation takes
it off the list.

![The Ingredients page](/img/screenshots/ingredients-list.png)

An ingredient filed under a parent uses the parent's aisle, nutrition and icon
until it has its own.

## AI keeps the catalogue

AI changes nothing in the catalogue until an administrator chooses what it
does under [Ingredient catalogue](../configuration/ai-provider.md#ingredient-catalogue).
It never runs at startup or at night.

With **Clean up new ingredients** selected, AI looks at every new ingredient
moments after a recipe, grocery or pantry item adds it. **Clean up catalogue**
does the same for the ingredients already there. AI then does one of these:

- merges it into the food it is ("uien" into "onion"). A food only spelled
  like it, a letter or two apart, is merged only when AI picks it
- files it under a parent ("cherry tomatoes" under "tomato"), a blend under
  its group ("Cajun seasoning" under "mixed spices"), or takes away
  one its name gave it that it is no kind of ("peanut butter" under "butter")
- gives it a clean name ("GR OF CANNED TUNA" becomes "Canned Tuna")
- splits a name that is several foods ("Dijon or yellow mustard", or "salt
  cinnamon" with no joining word). A spelling of one of those foods that it
  also has becomes an ingredient of its own
- deletes it when it is not a food, like a tool ("deegroller") or a fragment
  of a line ("melted"). Recipe lines and groceries keep their text. A fragment
  AI is not sure of is only flagged

AI leaves alone an ingredient you marked distinct, renamed or gave a parent,
every ingredient from the catalogue source, and one no recipe uses, which it
also never merges another into or files another under.

A Clean up catalogue run over the **Whole catalogue** also asks about the
ingredients from the catalogue source, and ignores what people decided or
undid for that run. It never deletes one from the catalogue source. It also
checks the translations people, imports and merges added to them. A
translation that names no food, like "boneless" on chicken breast, is removed
and goes on the list of texts that are not a food. One that names another food,
like "kippendijen" on chicken breast, moves to that food. Recipe lines and
groceries that used a removed translation are read again from their text.

### Filling gaps

AI can also fill in what an ingredient is missing: its nutrition, what a
spoonful and one piece weigh, and its [icon](./ingredient-icons.md). It does
this for new ingredients where an administrator selected it, and for every
ingredient at once with **Fill gaps**. It never replaces what an ingredient
has, or your household's correction. Nutrition AI filled reads **Estimated by
AI**. See [Nutrition](../recipes/nutrition.md#where-the-numbers-come-from).

### Changed by AI

**Changed by AI** at the top of the page lists everything AI did in the last
month. Changes AI was not sure of come first, with **Keep** and **Undo**, and
flag their ingredient until you choose. **Undo** puts back what the change took,
deleted ingredients and their lines included, and AI never makes that change
again.

![Changed by AI](/img/screenshots/ingredients-changed-by-ai.png)

## Deleting

**Delete** in an ingredient's panel always works. The dialog says how many
recipe lines and groceries keep their text without it, and how many pantry
items go with it. Those lines and groceries are then read again: one whose text
names other foods points at them, so deleting a "kruidenmix" with the
translation "zout en peper" points a "zout en peper" line at salt and pepper,
and a "zout en peper" grocery becomes two. Nothing new is added. Removing a
translation moves what used it to another of the ingredient's names, and asks
whether the text is not a food: **Not a food** puts it on that list, **Just
remove** only removes it.

![Deleting an ingredient](/img/screenshots/ingredients-delete.png)

An ingredient someone added that nothing has used for three months is deleted
by itself. A recurring grocery counts as a use, so a grocery set to repeat
yearly keeps its ingredient.

## Data sources

The catalogue is built on the Open Food Facts ingredients taxonomy, under the
[Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/).
Nutrition comes from CIQUAL 2025 and CALNUT (ANSES), USDA FoodData Central and
CoFID.

![The Data sources section of the Ingredients page](/img/screenshots/ingredients-data-sources.png)

Administrators can point the nightly fetch at a mirror, or turn it off, with
[`INGREDIENT_CATALOGUE_URL`](../configuration/server-runtime.md#ingredient-catalogue).
