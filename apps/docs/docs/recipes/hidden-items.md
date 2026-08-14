---
sidebar_position: 5
title: Hidden Items
description: Choose what you would rather not be shown, from Recipe Provenance and Nutrition Information to ratings, favorites and timers. Everything is shown by default, and hiding changes only your own view.
---

# Hidden Items

A recipe page carries more than the dish itself: where it comes from, what is
in it nutritionally, notes, a rating, a heart for favorites, a conversion
control, timers in the steps. If you cook without ever reading some of those,
you can tell Norish so. A Hidden Item is something you have chosen not to be
shown, and the page simply gets shorter for you.

Everything is shown by default. Hiding is a choice you make once, in your own
settings, and it follows you between devices.

## What can be hidden

Settings → User → **Hidden Items** is a single control listing everything you
can choose not to see:

- **Provenance**, the Recipe Provenance section: country, region, cuisines and
  the explanatory note
- **Nutrition**, the Nutrition Information section
- **Notes**, the notes section on the recipe page
- **Ratings**, the rating section on the recipe page, the rating on library
  cards and the rating filter
- **Favorites**, the heart wherever it appears and the favorites filter
- **Ingredient conversion**, the measurement conversion control on the recipe
  page
- **Recipe timers**, the timer affordances in recipe steps

![The Hidden Items control in user settings](/img/screenshots/hidden-items-settings.png)

Hiding an item suppresses it everywhere it would appear for you, not just in
one place. Hiding ratings, for example, takes the recipe page's stars, the
library card's rating and the rating filter together. Items that exist only on
the recipe page simply make the page slimmer:

![A recipe page with Recipe Provenance, Nutrition Information and notes hidden](/img/screenshots/hidden-items-recipe.jpg)

Recipe timers appear in the list only while your administrator has timers
enabled for the instance. A choice you made earlier is kept either way and
takes effect again when the capability returns.

## Hiding changes only your view

A Hidden Item settles nothing about the recipe. What is stored, what may be
edited and what Recipe Enrichment produces are all unchanged, and every other
member of your household still sees everything. Someone reading a recipe
through a share link, or signed out, sees the whole page.

One deliberate exception: the origin flag beside a recipe's title stays when
Recipe Provenance is hidden. The flag is part of the recipe's chrome, like its
image, rather than part of the Recipe Provenance section, so you keep the
at-a-glance origin even with the section hidden.
