---
sidebar_position: 3
title: The recipe page
description: The recipe layout, metric and US conversion, cooking mode and the dish-coloured page.
---

# The recipe page

On a phone, a recipe opens with its photo, the title and the **Glance Bar**:
total time, servings and calories in one row.

![A recipe page on a phone, tinted by its own photo, with the Glance Bar under the title](/img/screenshots/recipe-page-mobile.png)

The Glance Bar follows the servings you pick. Hiding nutrition under
[Hidden Items](./hidden-items.md) removes the calories from it, and a recipe
with none of the three has no bar.

## Sections

Each section is its own card, in cooking order: **Ingredients**, **Steps**,
**Notes**, then **Cooking time**, **Nutrition**, **Provenance**, **Source** and
the rating. Empty sections are left out.

- **Cooking time** shows preparation and cooking time against the total. Time
  those two don't cover, like a dough rising, shows as **Other Time**.
- **Nutrition** shows the macros as a ring with the calories in the middle. A
  recipe that stores no nutrition shows values worked out from its ingredients,
  marked as such, see [Nutrition](./nutrition.md).
- **Rating**: tap a star to rate, or tap your chosen star again to remove
  your rating.

![The Cooking time card with an Other Time segment, above the Nutrition ring](/img/screenshots/recipe-page-cards.png)

## Servings

Use **-** and **+** beside Ingredients to change servings one at a time; all
amounts scale with them. Tap the number to choose **½×** to **4×** the original
servings, or enter a serving count or multiplier, such as 1.5.

![The Servings panel over a recipe, with the Servings and Multiplier fields above the ½× to 4× buttons](/img/screenshots/recipe-servings-panel.png)

## Metric and US measurements

The Ingredients card's menu converts a recipe between metric and US units,
without AI. Cups become millilitres, ounces become grams, and oven temperatures
in the steps convert too. Foods you don't pour, like flour or butter, go from
cups to grams when their weight is known. Teaspoons and tablespoons stay as
they are.

Choose **Original** to return to the unchanged recipe. With AI set up,
**Convert with AI** uses the language model instead.

To convert every recipe as you open it, pick a system under
**Settings => User => Preferences => Measurements**. This applies to recipes
you can edit. **Metric with AI** and **US with AI** use the language model for
recipes that have no converted copy yet.

![The Ingredients card options on a phone, offering Convert to US and Convert to US with AI](/img/screenshots/recipe-convert-menu.png)

## Cooking mode

The **Cook** button in the bottom-left corner opens cooking mode. It shows one
step per screen with that step's ingredients and amounts. Swipe up or down to
change step and sideways for the ingredient list. The bottom bar has progress,
timers, the ingredients, keep-screen-on and the next step.

![Cooking mode with step ingredients and Ready At in the bottom bar](/img/screenshots/cooking-mode-mobile.png)

The bottom bar also shows **Ready At**, the time you opened cooking mode plus
the recipe's total time. Closing cooking mode ends the session, and opening it
again starts at the first step.

## Page colour

Recipe pages use a tint from their photo, visible before the photo loads and
while offline. The tint follows your light or dark theme to keep text
readable. Recipes without photos use the plain theme.

To turn it off, set **Settings => User => Recipe page color** to
`Plain theme colors`. This is kept separately for phone and desktop.

## Print a recipe or save a PDF

Choose **Print recipe** from the recipe's three-dot menu to print an A4
recipe card or save it as a PDF to share.

## Shared recipes

A shared recipe link shows the same layout without the parts that need an
account: favourites, rating, provenance and cooking mode. Hidden Items don't
apply to it.
