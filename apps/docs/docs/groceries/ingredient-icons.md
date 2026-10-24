---
sidebar_position: 5
title: Ingredient icons
description: The picture beside an ingredient.
---

# Ingredient icons

Ingredients can have an icon. It shows:

- beside the ingredient lines on a recipe
- in the recipe editor, once a line matches an ingredient
- on the grocery list, on desktop
- in the [Pantry](./pantry.md)
- on the [Ingredients](./ingredients.md) page and in an ingredient's panel

![A recipe's ingredient lines, each with the icon of its food](/img/screenshots/ingredient-icons-recipe.png)

## Which icon shows

1. The ingredient's own icon, uploaded or generated.
2. The built-in icon. Norish ships icons for the foods in its starting
   catalogue.
3. The parent's icon, so "red onion" shows the onion.

An ingredient with none of these shows a placeholder on the Ingredients page
and in its panel.

## Setting an icon

Open the ingredient on the Ingredients page, or anywhere its panel opens, and
click its icon:

- **Upload a picture** takes or uploads a photo. Norish removes the background
  when it can.
- **Generate with AI** draws one with your server's
  [image provider](../configuration/ai-provider.md#image-generation). Brands are never drawn.
- **Remove icon** removes it.

## Drawing many at once

An administrator can have AI draw missing icons for new ingredients, or for
every ingredient at once with **Fill gaps**. See
[Ingredient catalogue](../configuration/ai-provider.md#ingredient-catalogue).
Only an ingredient with no icon to show, not even its parent's, gets one.
Broad groups like "vegetable" stay without.

## Hiding icons

Turn icons off under **Settings => User => Hidden items => Ingredient icons**.
See [Hidden Items](../recipes/hidden-items.md).
