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

Find it under **Settings => Ingredients**.

## Catalogue source

Norish starts from the [Open Food Facts](https://world.openfoodfacts.org)
ingredients list and refreshes it every night.

A new name from a recipe, grocery or pantry is matched to an existing
ingredient, ignoring plurals, amounts, units and preparation. "finely chopped
onions" matches "onion", and "4 el bosui" matches "bosui". When nothing
matches and AI is set up, AI decides where the name belongs, and the ingredient
is **flagged** for review.

![The Ingredients page, with a flagged ingredient](/img/screenshots/ingredients-page.png)

An ingredient filed under a parent uses the parent's aisle, nutrition and icon
until it has its own.

## Cleaning names

Names from recipes and shops can carry words that aren't the food, like "GR OF CANNED TUNA".
**Fix catalogue** at the top of the page has AI suggest a
clean name, "Canned Tuna", keeping the language and the brand.
Suggestions wait under **Suggestions** until you accept or dismiss them.

![Fix catalogue](/img/screenshots/ingredients-clean-names.png)

Administrators can have new ingredients cleaned automatically, see
[New ingredients](../configuration/ai-provider.md#new-ingredients).

## Data sources

The catalogue is built on the Open Food Facts ingredients taxonomy, under the
[Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/).
Nutrition comes from CIQUAL 2025 and CALNUT (ANSES), USDA FoodData Central and
CoFID.

![The Data sources section of the Ingredients page](/img/screenshots/ingredients-data-sources.png)

Administrators can point the nightly fetch at a mirror, or turn it off, with
[`INGREDIENT_CATALOGUE_URL`](../configuration/server-runtime.md#ingredient-catalogue).
