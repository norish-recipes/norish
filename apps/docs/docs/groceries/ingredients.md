---
sidebar_position: 4
title: Ingredients
description: One catalogue of foods, each known by every spelling and language, so what you teach Norish about one spelling holds for all of them.
---

# Ingredients

Norish keeps one catalogue of **ingredients**. Each ingredient is one food, known
by every spelling it has been seen as: “onion”, “onions”, “onion, diced”, “ui” and
“oignon” are one ingredient.

Your recipes and your grocery list still show exactly what you or the recipe
wrote, “2 onions, diced” stays “2 onions, diced”. But whatever you teach Norish
about a food, you teach it once:

- An [aisle](./aisles.md) you file “onion” under files “onions” and “ui” too.
- A [product](./prices.md) you link to “milk” prices “melk”.
- “ui” in the [pantry](./pantry.md) covers an English recipe's “onion”.

## Where the catalogue comes from

A new Norish already knows thousands of foods in many languages. The catalogue
starts from the [Open Food Facts](https://world.openfoodfacts.org) ingredients
taxonomy, which Norish fetches when it starts and every night, and grows with every
recipe you import and every grocery you add.

When Norish meets a name it does not know, it checks it against the spellings it
has, then without the preparation (“onions, diced” is “onions”), and then, if
[AI](../configuration/ai-provider.md) is set up, asks what food it is. Only when
none of these is sure does it add a new ingredient, **flagged** for you to check.

## The Ingredients page

Open **Settings → Ingredients** to see the catalogue. Search finds an ingredient
by any of its spellings, in any language. Each row shows the ingredient in your
language, the spellings in your language and the ones your household added, and
**More spellings** shows the rest.

![The Ingredients page, with a flagged ingredient](/img/screenshots/ingredients-page.png)

Turn on **Only flagged** to see what Norish was not sure about. For each one:

- **Merge into…** when it is a food Norish already knows. All of its spellings,
  and every recipe line, grocery and pantry item that uses them, join the other
  ingredient. Where both had an aisle, a product or a store preference at the same
  Store, the one you merge into wins.
- **Mark distinct** when it really is a food of its own.

![Merging an ingredient into another](/img/screenshots/ingredients-merge.png)

You can also:

- **Add a spelling**, such as your household's word for a food.
- **Move a spelling** to another ingredient, or to a new one, with the arrow on
  its chip. This undoes a wrong merge.
- **Rename** an ingredient.
- **Set parent…** to say an ingredient is a kind of another, such as “cherry
  tomatoes” under “tomatoes”. A kind of a food uses its parent's aisle until it
  has one of its own, and covers its parent in the pantry. It never borrows its
  parent's product, so a recipe that asks for “red onion” is never priced as plain
  onion.

Renaming, setting a parent or marking an ingredient distinct clears its flag. Who
may change an ingredient someone else added is up to your server admin, see
[Ingredient permissions](../configuration/admin-settings.md#ingredient-permissions).
Changes reach everyone's lists straight away.

## Data sources

The catalogue is built on the Open Food Facts ingredients taxonomy, available
under the [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/),
and Norish offers the catalogue it builds under the same licence. The **Data
sources** section of the Ingredients page credits it and lets anyone signed in
download the whole catalogue, with every spelling and parent, as JSON.

![The Data sources section of the Ingredients page](/img/screenshots/ingredients-data-sources.png)

Administrators can point the nightly fetch at a mirror, or turn it off, with
[`INGREDIENT_CATALOGUE_URL`](../configuration/server-runtime.md#ingredient-catalogue).

[Pantry](./pantry.md) · [Aisles](./aisles.md) · [Prices](./prices.md)
