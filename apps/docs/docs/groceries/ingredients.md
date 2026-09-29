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

Open **Settings → Ingredients** to see the catalogue. Flagged ingredients come
first. Each ingredient is a line: its name in your language, whether Norish
flagged it and why, and how many spellings it goes by. Press a line to open the
ingredient's panel.

Search finds an ingredient by any of its spellings, in any language, and reads
what you type as the start of a word: `cola` finds “cola” and “cola nut”, never
“chocolate”. For more, use `%` for anything and `<…>` for exactly this:

| You type | Finds                                |
| -------- | ------------------------------------ |
| `cola`   | names with a word starting with cola |
| `<cola>` | exactly cola                         |
| `%cola%` | anything containing cola             |
| `cola%`  | anything starting with cola          |
| `%cola`  | anything ending in cola              |

An ingredient named exactly what you typed is listed first. The same search
works in the box that picks an ingredient for a merge, a parent or a move.

![The Ingredients page, with a flagged ingredient](/img/screenshots/ingredients-page.png)

The panel shows the ingredient's name, its parent, and its spellings in
your language and the ones your household added (**More spellings** shows the
rest). Every change is saved as you make it. What you may change depends on who
added the ingredient; a control you may not use is not shown.

![An ingredient's panel](/img/screenshots/ingredients-panel.png)

- **Name**: type a new name and save it. The old spellings stay.
- **Parent**: **Set parent…** (or **Change parent…**) says an ingredient is a
  kind of another, such as “cherry tomatoes” under “tomatoes”. A kind of a food
  uses its parent's aisle until it has one of its own, and covers its parent in
  the pantry. It never borrows its parent's product, so a recipe that asks for
  “red onion” is never priced as plain onion. The cross on the parent removes it.
- **Spellings**: add one, such as your household's word for a food. The arrow on
  a spelling moves it to another ingredient, or to a new one, which undoes a
  wrong merge. The cross removes a spelling nothing uses.
- **Merge into…** when this is a food Norish already knows. All of its spellings,
  and every recipe line, grocery and pantry item that uses them, join the other
  ingredient. Where both had an aisle, a product or a store preference at the same
  Store, the one you merge into wins.
- **Delete** an ingredient nothing uses. Its spellings go with it. One a recipe,
  grocery or pantry item still uses cannot be deleted: merge it into the food it
  is instead.

Choosing another ingredient, for a merge, a parent or a spelling's move, opens a
second panel over the first with a search box.

![Merging an ingredient into another](/img/screenshots/ingredients-merge.png)

### Flagged ingredients

Turn on **Only flagged** to see what Norish was not sure about. A flagged
ingredient's panel opens with the reason at the top: AI was off or not sure, no
known food shared a word with the name, the upgrade added it, or the catalogue
lists several foods it could be. Two buttons settle it:

- **Ask AI** has Norish ask its AI what the food is, now that the catalogue is
  there to compare it with. It looks harder than an import does: when no known
  food shares a word with the name, it asks what plain food the name is (“uien”
  is “onion”, “Unox Knaks” is a frankfurter) and compares it with the foods that
  name finds. A sure answer is acted on: merged into the food it is, filed as a
  kind of one, or marked distinct. An unsure answer leaves the flag and says so.
  Either way the message says what AI tried: what it read the name as, and
  which foods it compared it with, so you can judge the answer or merge by
  hand.
- **Mark distinct** when it really is a food of its own.

Whenever the list shows flagged ingredients you may edit, one button above it
asks AI about each of them in turn and says what came of it.

Renaming, setting a parent or marking an ingredient distinct clears its flag. Who
may change an ingredient someone else added is up to your server admin, see
[Ingredient permissions](../configuration/admin-settings.md#ingredient-permissions).
Every change reaches everyone's lists and open Ingredients pages straight away.

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
