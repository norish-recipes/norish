---
sidebar_position: 5
title: Ingredient icons
description: A small picture beside every food, wherever a food is named, so the garlic is found at a glance.
---

# Ingredient icons

Every ingredient can show an **ingredient icon**: a small, soft 3D picture of the
food on a transparent background, beside its name wherever a food is named, so a
cook finds “the garlic” and a shopper scans the list at a glance. The icons sit
cleanly on any page, light or dark.

Icons show on:

- a recipe's ingredient lines, in cooking mode, on a step's ingredient chips, and on
  a recipe shared by link;
- the recipe editor, as soon as a typed name matches a food Norish knows;
- the grocery list, recurring groceries included;
- the [Pantry](./pantry.md);
- the [Ingredients](./ingredients.md) page and an ingredient's panel.

An icon belongs to the food, not to a spelling: “2 onions, diced” and “1 ui” show
the same onion. It is the same for every household on the server. Section headings
in an ingredient list, and lines that name no food, show nothing. A food with no
icon anywhere shows a muted placeholder, so the list keeps its alignment.

## Which icon a food shows

A food shows the first of these it has:

1. **Its own icon**, one somebody uploaded or generated for it.
2. **The icon Norish ships** for it. Norish comes with an icon for the foods its
   catalogue is seeded with, drawn once in one style, so a new server has icons
   without any setup or image provider.
3. **Its parent's icon.** A food with no icon of its own shows the icon of the
   food it is a kind of: a red onion shows the onion. Broad groups at the top of
   the tree (vegetable, fruit, dairy) are left without an icon, so a food never
   borrows a vague one; it shows the placeholder instead.

An icon somebody sets always wins over the shipped one and survives a new release.
Removing it brings back the shipped icon, or the parent's.

## Setting an icon

Open the food in the [Ingredients](./ingredients.md) page, or from anywhere its panel
opens, and click its icon:

- **Upload a picture** takes a photo or a product shot. A picture on a plain
  background is cut out automatically; one whose background isn't one flat colour
  is kept as it is.
- **Generate with AI** draws the icon with your server's image provider, from the
  food's name and what it is a kind of (“pepper, a kind of spice”), in the style
  every icon on your server shares. It shows only when an
  [image provider](../configuration/ai-provider.md#image-generation) is set up.
- **Remove icon** takes the food's own icon off again.

The new icon waits in the panel until you press **Save**, like the rest of the panel,
so closing the panel leaves the food as it was. Who may change an ingredient's icon
is who may change the ingredient, under **Settings → Admin → Permissions**; a food
from the seeded catalogue is an admin's.

## Drawing many at once

**Draw icons**, at the top of the Ingredients page, draws icons for many foods in
one go. It first asks which foods:

- **Only foods with no icon at all**, the default. A food that already borrows its
  parent's icon is left alone.
- **Every food without its own icon**, which also redraws foods that show a shipped
  or a parent's icon.

Each choice says how many icons it will draw, across the whole catalogue: only the
foods you may change, and never the broad groups that are left without an icon on
purpose. The round then runs in the background, carries on after you close the tab,
and shows how far it has come at the top of the page. A food whose drawing fails is
skipped and the round goes on. Each icon becomes the food's own straight away; give a
food another one in its panel if you'd rather.

Draw icons shows only when an image provider is set up and there is something for
you to draw.

## Hiding icons

A reader who would rather see plain text, on a small phone say, can hide every
icon on their phone or desktop under **Settings → User → Hidden items → Ingredient icons**.
See [Hidden Items](../recipes/hidden-items.md).

## For self-hosters

The icons are served by your own server, and the shipped set is built into the
Norish image, so a reader's browser never calls a third party. Icons you upload or
generate are stored under your uploads directory. Generating uses your
[image provider](../configuration/ai-provider.md#image-generation) at its cheapest
quality, since an icon is shown small.
