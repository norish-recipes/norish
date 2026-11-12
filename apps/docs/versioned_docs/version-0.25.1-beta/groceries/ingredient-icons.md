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

## Setting an icon

Open the ingredient on the Ingredients page, or anywhere its panel opens, and
click its icon:

- **Upload a picture** takes or uploads a photo. Norish removes the background
  when it can.
- **Generate with AI** draws one with your server's
  [image provider](../configuration/ai-provider.md#image-generation). Brands are never drawn.
- **Remove icon** removes it.

## Drawing many at once

**Draw icons** at the top of the Ingredients page draws missing icons for:

- **Only foods with no icon at all**, the default. Foods that show their
  parent's icon are skipped.
- **Every food without its own icon**, which also draws foods that show a
  built-in or parent icon.

## Hiding icons

Turn icons off under **Settings => User => Hidden items => Ingredient icons**.
See [Hidden Items](../recipes/hidden-items.md).
