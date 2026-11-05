---
sidebar_position: 7
title: Step ingredients
description: Show the ingredients and amounts each step uses, linked by hand or by AI.
---

# Step ingredients

Linked ingredients appear below each step with their amounts. _"Add half the
water"_ shows **25 ml water** when the recipe has 50 ml; _"add the spices"_
shows each spice. The step's text stays as written.

![Amounts under a step on the recipe page](/img/screenshots/step-ingredients-recipe.png)

Cooking mode shows them under the current step, and shared recipes show them
too.

![Cooking mode showing a step's ingredients](/img/screenshots/step-ingredients-cooking-mode.png)

## Linking steps yourself

In the recipe form, type `@` in a step or use the **Link ingredient** picker
under it. A step can use part of a line: half, a third, a quarter, or an exact
amount. Amounts follow the servings and the metric or US conversion. See
[Creating and editing recipes](./creating-and-editing.md).

## Letting AI fill the gaps

Choose **Link Ingredients to Steps** in a recipe's actions menu to have AI
fill steps that have no ingredients yet. Steps you linked yourself are never changed.

Your administrator can turn on **Ingredient linking** for new recipes under
**Settings => Admin => AI**. It is off by default.

The only run that replaces existing links is an administrator's
**Enrich** in Bulk enrichment with **Overwrite existing data** on.
