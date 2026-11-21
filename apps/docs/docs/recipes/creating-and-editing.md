---
sidebar_position: 2
title: Creating and editing recipes
description: The recipe form, with headings (#), recipe links (/) and step ingredients (@).
---

# Creating and editing recipes

Choose **Add Recipe**, or **Edit** in a recipe's menu. Enter one ingredient per
line, such as `200 g spaghetti`. Enter one step per row and drag to reorder.
Add photos to the recipe or to a step.

## Categories

Under **Tags & Categories**, type a name in **Add a category** and press Enter.
Your household can then select it or use it as a filter.

![Drinks added beside the built-in Categories on the recipe form](/img/screenshots/recipe-form-add-category.png)

A category stays on the list while a recipe in your household uses it.

## Headings with `#`

Start an ingredient or a step with `#` to make it a heading, like
`# For the sauce`. Headings are not numbered as steps.

![A step section heading written with #](/img/screenshots/editor-section-heading.png)

## Recipe links with `/`

Type `/` in a step and pick a recipe to link to it.

![The / recipe autocomplete open over a step](/img/screenshots/editor-recipe-link-autocomplete.png)

## Step ingredients with `@` {#step-ingredients}

Type `@` in a step and pick an ingredient. Norish adds its name to the step
and shows a chip below it.

![The @ mention autocomplete, with chips beneath the step](/img/screenshots/editor-mention-chips.png)

Use **Link ingredient** to add a chip without editing the step. If Norish asks
for an amount, enter it or press Escape to use the full amount.

![Amount entry for a newly linked ingredient](/img/screenshots/editor-amount-ask.png)

Choose **Amount…** on the chip to change the quantity. Tap the chip to remove it.

![Amount entry on a chip beneath a step](/img/screenshots/editor-amount-entry.png)

Linked amounts scale with servings. **Link Ingredients to Steps** in the
recipe menu fills steps that have no links.

## Recipe origin

Set the country, region, cuisines and note in the provenance fields. The
country flag appears beside the recipe title.

![Editing recipe provenance in the recipe form](/img/screenshots/provenance-form.png)

## Fill in recipe details with AI

With AI enabled, use the recipe's **⋯** menu for **Auto-tag**, **Detect
Allergies**, **Auto Categorize**, **Estimate Nutrition**, **Work Out Provenance**,
**Link Ingredients to Steps** or **Generate Picture**. **Detect Allergies**
requires household allergies, and **Generate Picture** needs an
[image provider](../configuration/ai-provider.md#image-generation).

These actions can replace categories, nutrition, provenance or the main
picture. [Automatic enrichment](../configuration/ai-provider.md#automatic-enrichment)
keeps details you entered or imported.

## Cookbooks

Use the recipe's quick actions to add it to a cookbook. Cookbooks follow
your server's [recipe permissions](../configuration/admin-settings.md#permissions).
Deleting a cookbook keeps its recipes. Deleting a recipe removes it from
every cookbook.
