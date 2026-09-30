---
sidebar_position: 4
title: Ingredients
description: One catalogue of foods, each known by every translation and language, so what you teach Norish about one translation holds for all of them.
---

# Ingredients

Norish keeps one catalogue of **ingredients**. Each ingredient is one food, known
by every translation it has been seen as: “onion”, “onions”, “onion, diced”, “ui” and
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

When Norish meets a name it does not know, it checks it against the translations it
has, then without the preparation (“onions, diced” is “onions”), and then, if
[AI](../configuration/ai-provider.md) is set up, asks what food it is. Only when
none of these is sure does it add a new ingredient, **flagged** for you to check.

## The Ingredients page

Open **Settings → Ingredients** to see the catalogue as a tree of kinds: the
foods not filed under any other, flagged ones first. An ingredient with kinds
carries a chevron that folds them out beneath it, as deep as the tree goes:
“chocolate” opens to “white chocolate”, which opens to “Belgian white
chocolate”. Each ingredient is a line: its name in your language, whether Norish
flagged it and why, how many translations it goes by and how many kinds it has.
Press a line to open the ingredient's panel.

Search finds an ingredient by its name or any of its translations, in any
language, and reads what you type as contained anywhere: `cola` finds “cola”,
“cola nut” and “chocolate”. The filters button beside the search box opens a
panel that changes that, and lands with **Apply**:

- **Contains** or **Exact**: whether the text may sit anywhere in a name, or
  must be the whole of it.
- **Name**, **Translations**, **Parent**: where to look. Turn on **Parent** to
  find every kind of a food by the food it is filed under, such as every onion
  by “onion”. At least one stays on.
- **Only flagged**: just the ingredients Norish was not sure about.
- **Without parent or kinds**: the ingredients filed under nothing that nothing
  is filed under, the ones a parent could still be found for.

The list loads more as you scroll. Under a search or a filter it is flat rather
than a tree, since a match may sit at any depth; turn off **Hierarchical view** in
the filters panel to list every ingredient flat at any time.

An ingredient named exactly what you typed is listed first. The same search
works in the box that picks an ingredient for a merge, a parent or a move.

![The Ingredients page, with a flagged ingredient](/img/screenshots/ingredients-page.png)

The panel shows the ingredient's name, its parent, and how many translations
it has; press that row to see, add, move or remove them in a panel of their own. Changes to the name, the parent and the translations wait for **Save**
at the bottom of the panel; close the panel to drop them. What you may change
depends on who added the ingredient; a control you may not use is not shown.

![An ingredient's panel](/img/screenshots/ingredients-panel.png)

- **Name**: type a new name. The old translations stay.
- **Parent**: **Set parent…** (or **Change parent…**) says an ingredient is a
  kind of another, such as “cherry tomatoes” under “tomatoes”. A kind of a food
  uses its parent's aisle until it has one of its own, and covers its parent in
  the pantry. It never borrows its parent's product, so a recipe that asks for
  “red onion” is never priced as plain onion. The cross on the parent removes it.
  **Find parent with AI** asks Norish's AI what food this is a kind of and files
  it there on a sure answer; if AI thinks the ingredient is the same as another,
  it says so and leaves the merge to you.
- **Translations**: add one, such as your household's word for a food; it joins
  the list as a chip until you save. The arrow on a translation moves it to
  another ingredient, or **Make it a base ingredient**, which undoes a wrong merge; a move lands
  on its own, from its own panel. The cross marks a translation nothing uses for
  removal, struck through until you save, with an undo in its place.
- **Merge into…** when this is a food Norish already knows. All of its translations,
  and every recipe line, grocery and pantry item that uses them, join the other
  ingredient. Where both had an aisle, a product or a store preference at the same
  Store, the one you merge into wins.
- **Delete** an ingredient nothing uses. Its translations go with it. One a recipe,
  grocery or pantry item still uses cannot be deleted: merge it into the food it
  is instead.

Choosing another ingredient, for a merge, a parent or a translation's move, opens a
second panel over the first with a search box.

![Merging an ingredient into another](/img/screenshots/ingredients-merge.png)

### Flagged ingredients

Turn on **Only flagged** to see what Norish was not sure about. A flagged
ingredient's panel opens with the reason at the top: AI was off or not sure, no
known food shared a word with the name, the upgrade added it, or the catalogue
lists several foods it could be. Two buttons settle it:

- **Ask AI** has Norish ask its AI what the food is, now that the catalogue is
  there to compare it with. It looks harder than an import does: it first asks
  what plain food the name is and what it is a kind of (“uien” is “onion”,
  “Grand'Italia Fusilli” is fusilli, a kind of pasta), looks those up, and
  compares the name with them and with the foods sharing its words. AI never
  changes anything itself: its answer is a **suggestion** that waits for you.
  A suggested parent is filled into the **Parent** field, marked **Suggested by
  AI**, and lands when you press **Save**, or goes away with its ×. A suggested
  merge, or “a food of its own”, sits at the top of the panel with **Confirm**
  and **Dismiss**. The name, the translations and the rest stay yours to edit
  meanwhile. AI always looks for a parent: it asks what a food is a kind of,
  and suggests the parent even when it is not quite sure. An answer that names
  nothing leaves the flag and says so. Either way it says what AI tried: what
  it read the name as, and which foods it compared it with.
- **Mark distinct** when it really is a food of its own.

Whenever the list shows flagged ingredients you may edit, a button in the
card's header asks AI about all of them at once. Under **Without parent or
kinds**, the button asks instead what each ingredient on screen is a kind of.
That runs on the server as one job with a step per ingredient, so it carries
on if you close the tab: each flagged row shows **Asking AI…** until the round
ends. It asks a few ingredients at once, and the answers land together: the
**AI suggestions** panel then opens on its own for whoever started the round,
and the suggestions button in the card's header opens it whenever any are
waiting. The panel lists one line per ingredient with what AI proposes and how
it got there, each with **Confirm** and **Dismiss**, and **Confirm all** / **Dismiss all**
at the bottom. Confirming makes the change as your own edit. Many ingredients
may be suggested under the same parent. Below them, the ingredients the round
had nothing to suggest for say why: AI was not sure, the ingredient was passed
over, or its question failed. Anyone who opens the page meanwhile sees the same
rows waiting, and the round shows in the admin job monitor as **Ask AI about
ingredients**, with the models it asked.

Renaming, setting a parent or marking an ingredient distinct clears its flag. Who
may change an ingredient someone else added is up to your server admin, see
[Permissions](../configuration/admin-settings.md#permissions).
Every change reaches everyone's lists and open Ingredients pages straight away.

## Data sources

The catalogue is built on the Open Food Facts ingredients taxonomy, available
under the [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/),
and Norish offers the catalogue it builds under the same licence. The **Data
sources** section of the Ingredients page credits it and lets anyone signed in
download the whole catalogue, with every translation and parent, as JSON.

![The Data sources section of the Ingredients page](/img/screenshots/ingredients-data-sources.png)

Administrators can point the nightly fetch at a mirror, or turn it off, with
[`INGREDIENT_CATALOGUE_URL`](../configuration/server-runtime.md#ingredient-catalogue).

[Pantry](./pantry.md) · [Aisles](./aisles.md) · [Prices](./prices.md)
