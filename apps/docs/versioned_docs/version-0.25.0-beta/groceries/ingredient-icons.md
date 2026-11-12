---
sidebar_position: 5
title: Ingredient icons
description: The image beside an ingredient.
---

# Ingredient icons

Ingredients can have an **icon**. These icons show on:

- **Recipe page** Beside the ingredient lines;
- **Recipe editor** As soon as a name matches a food;
- **Grocery list** Only for desktop devices;
- **[Pantry](./pantry.md)**;
- **[Ingredients](./ingredients.md)** page and an ingredient's panel.

![A recipe's ingredient lines, each with the icon of its food](/img/screenshots/ingredient-icons-recipe.png)

## What icon is used

The following rules are used in order of priority:

1. **Its own icon**, Either uploaded or generated.
2. **The default set** Norish comes with an icon for the foods the
   catalogue has been seeded with.
3. **The parent's icon** A food with no icon of its own shows the icon of the
   parented food e.g.: Red onions is the child of onion so an onion would be shown.

## Setting an icon

Open the food in the [Ingredients](./ingredients.md) page, or from anywhere its panel
opens, and click its icon:

- **Upload a picture** takes a photo or upload one, when the background can be removed
  it will be removed.
- **Generate with AI** draws the icon with your server's image provider.
  [image provider](../configuration/ai-provider.md#image-generation). A branded product is
  drawn as it is sold, without its brand.
- **Remove icon**

## Drawing many at once

The **Draw icons** button at the top of the ingredient page draws missing icons.
This can be done under the following options:

- **Only foods with no icon at all**, Default. A food that borrows from its
  parent's will be skipped as well.
- **Every food without its own icon**, which also redraws foods that show a pre-generated
  or the parent's icon.

## Hiding icons

If you would rather not see the ingredient icons you may turn these off in:
**Settings => User => Hidden items => Ingredient icons**. This is per device
See [Hidden Items](../recipes/hidden-items.md).
