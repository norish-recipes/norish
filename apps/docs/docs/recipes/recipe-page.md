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

## Linked recipes

When a step links another recipe with `/`, that recipe's steps show right after
the step, in a section headed **From recipe** and the recipe's name. They count
from 1, as on their own page, and the recipe's own steps carry on numbering
after them. The arrow folds the section away. The name opens the recipe.

![A pizza's steps with its linked dough's steps in place, and the dough's own linked starter inside them](/img/screenshots/recipe-linked-steps.png)

The linked recipe's ingredients are listed after the recipe's own, under the
same header, so everything the dish needs is in one list. They follow the
servings you pick: doubling the pizza doubles its dough. **Add to groceries**
adds them as well.

A few rules keep this readable:

- A step that is nothing but the link, like `/Garlic Aioli` on its own, is
  replaced by the linked recipe's section rather than shown as a step of its
  own. A step with other words, like "Make the /Pizza Dough and let it rest",
  stays.
- A recipe linked twice shows its steps only at the first link. Later links
  stay plain links.
- A linked recipe that links another shows that one inside it, up to three
  levels deep.
- A recipe that links back to one already shown stays a plain link.
- A link to a recipe you can't open stays a plain link.

Cooking mode goes through the linked steps in place. Each one is marked with
the recipe it comes from, and the ingredients view lists the linked
ingredients too.

![Cooking mode on a step from the linked dough, marked From Neapolitan Dough](/img/screenshots/cooking-mode-linked-step.png)

Shared recipe links show the link's name only, without the linked recipe.

## Page colour

Each recipe page is tinted with a colour from its photo. The tint shows before
the photo loads and offline too. Your light or dark theme still sets how light
the page is, so text stays readable. Recipes without a photo use the plain
theme.

To turn it off, set **Settings => User => Recipe page color** to
`Plain theme colors`. This is kept separately for phone and desktop.

## Shared recipes

A shared recipe link shows the same layout without the parts that need an
account: favourites, rating, provenance and cooking mode. Hidden Items don't
apply to it.
