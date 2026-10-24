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

Each section is its own card, in cooking order: **Ingredients**, **Equipment**, **Steps**,
**Notes**, then **Cooking time**, **Nutrition**, **Provenance**, **Source** and
the rating. Empty sections are left out.

- **Cooking time** shows preparation and cooking time against the total. Time
  those two don't cover, like a dough rising, shows as **Other Time**.
- **Nutrition** shows the macros as a ring with the calories in the middle. A
  recipe that stores no nutrition shows values worked out from its ingredients,
  marked as such, see [Nutrition](./nutrition.md).
- **Rating** takes your stars. Tap the star you gave again to take your rating
  back.

![The Cooking time card with an Other Time segment, above the Nutrition ring](/img/screenshots/recipe-page-cards.png)

## Metric and US measurements

The Ingredients card's menu converts a recipe between metric and US units,
without AI. Cups become millilitres, ounces become grams, and oven temperatures
in the steps convert too. Foods you don't pour, like flour or butter, go from
cups to grams when Norish knows their weight. Teaspoons and tablespoons stay as
they are.

The original stays as written and the menu marks it **Original**, so you can
switch back. With AI set up, **Convert with AI** has the language model do the
conversion instead.

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

![Cooking mode on a phone: the step with its ingredient chips, and the bottom bar carrying Ready At](/img/screenshots/cooking-mode-mobile.png)

The bottom bar also shows **Ready At**, the time you opened cooking mode plus
the recipe's total time. Closing cooking mode ends the session, and opening it
again starts at the first step.

## Page colour

Each recipe page is tinted with a colour from its photo. The tint shows before
the photo loads and offline too. Your light or dark theme still sets how light
the page is, so text stays readable. Recipes without a photo use the plain
theme.

To turn it off, set **Settings => User => Recipe page color** to
`Plain theme colors`. This is kept separately for phone and desktop.

## Print a recipe or save a PDF

Choose **Print recipe** from the recipe's three-dot menu to print an A4
recipe card or save it as a PDF to share. The card includes ingredients,
instructions and nutrition, using your selected servings and measurements.
You can include the recipe photo and adjust the text size.

## Shared recipes

A shared recipe link shows the same layout without the parts that need an
account: favourites, rating, provenance and cooking mode. Hidden Items don't
apply to it.
