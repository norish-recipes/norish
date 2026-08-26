---
sidebar_position: 7
title: Cookbooks
description: Group recipes into titled sets, file a recipe from its own page, and browse the Library as recipes and cookbooks together under three chips.
---

# Cookbooks

A **Cookbook** is a titled set of recipes. It is the one thing in Norish that
groups recipes by intent rather than by attribute: tags, cuisines, categories,
rating and cooking time all describe what a recipe _is_, and a cookbook is
somewhere to _put_ things.

It is deliberately thin. A cookbook has a title, a set of members, and nothing
else to maintain — no description, no cover to upload, no ordering. Its cover
is drawn from the pictures of what is inside it, so it can never go stale.

## The Library and its three chips

The dashboard is your **Library**: everything you can see, recipes and
cookbooks together, in one list. Three chips under the search bar choose what
kind of thing is on screen, and the heading names the choice:

- **All** — _Your library_: both kinds, interleaved
- **Recipes** — _Your recipes_
- **Cookbooks** — _Your cookbooks_

![The Library under the All chip, with a cookbook and recipes in one list](/img/screenshots/cookbooks-library.png)

Under **All**, cookbooks and recipes share one list ordered by whatever sort
you chose — not two bands, and not cookbooks pinned on top. Both carry a title
and a creation date, so "Newest first" means newest first for everything on
screen. Your chip stays chosen on that device, so a Library you prefer to
browse by cookbook opens that way, and **Clear filters** leaves it alone.

Searching finds a cookbook by its title, and a matching cookbook is shown
ahead of the matching recipes. A cookbook has only a title to match on, so
removing **Title** from _Search in_ — in the Filters panel — takes cookbooks
out of search entirely. Filters that only mean something for a recipe (rating,
cooking time, categories, tags, favorites) simply show recipes.

## Making one

With the **Cookbooks** chip lit, the Add button becomes **+ Cookbook**. It asks
for a title and nothing else, then opens the cookbook so you can start filling
it — or leave it empty and fill it later, which is how you set up a Christmas
cookbook in November.

![Creating a cookbook from the Library](/img/screenshots/cookbooks-create.png)

## Filing a recipe

Open any recipe, then **Cookbooks** in its actions menu. The panel lists every
cookbook you may edit with this recipe's membership shown as a toggle, so the
same place both files and unfiles — undoing a mistake is not a hunt for a
different control. The row at the top makes a new cookbook already holding
this recipe, for when two things obviously belong together.

![The cookbook membership panel on a recipe](/img/screenshots/cookbooks-panel.png)

A recipe can be in as many cookbooks as you like, and filing the same one
twice changes nothing. Filing needs only that you can see the recipe and edit
the cookbook: the recipe itself is never written, so its owner is not
notified and nothing about it changes. Being collected is not an edit.

Every recipe page ends with a card naming the cookbooks it is in, each one a
link, or an invitation to file it when it is in none.

![The cookbooks card at the end of a recipe page](/img/screenshots/cookbooks-recipe-card.png)

If you do not use cookbooks, that card is a **Hidden Item**: turn it off once
under Settings => User => **Hidden Items**, per device, exactly as you can with
Nutrition Information or the rating. Hiding it affects the recipe page only —
never the Library or its chips.

## Browsing one

A cookbook has its own address, so it can be linked, bookmarked and reached
with the back button. It shows its recipes through the same grid the Library
uses, in your stored grid-or-list layout, and your sort, your search and the
Filters panel all apply inside it — which keeps a large cookbook usable. A
recipe can be taken out from here too.

![A cookbook's own page, showing its members](/img/screenshots/cookbooks-page.png)

The member count is what _you_ can see, so two people may honestly see
different counts for the same cookbook — the same rule the Library follows,
one level down.

## Who can see and change what

Cookbooks obey the recipe permission policy your administrator already set.
There is no second setting and no separate rule: on the shipped default,
cookbooks are as browsable across households as the recipes already are, and
an instance that keeps recipes private keeps cookbooks private too.

Nothing about cookbooks is destructive:

- Deleting a cookbook leaves every recipe it held untouched. It confirms by
  name first.
- Deleting a recipe takes it out of every cookbook it was in, and leaves those
  cookbooks standing — a cookbook that loses its last recipe keeps its title.
- A cookbook made by someone who later deletes their account stays. Like an
  orphaned recipe, it belongs to nobody and everyone can maintain it, so a
  departure never empties a shared Library.

## Offline

Every cookbook you can see, and what is in it, is part of the guaranteed
**Warm Set**, so your Library is not half empty the moment the backend is
unreachable. Opening a cookbook Offline lists its members; a member whose
detail was never cached says so rather than failing, because member recipes
keep the same fifty-recipe guarantee they always had.

Making a cookbook and filing recipes into it works Offline too. The change is
shown as applied and queued, and arrives intact once you are back — filing
queued behind a create still lands in the cookbook you made.

## Not included

- Selecting many recipes at once and adding them together.
- Cookbooks inside cookbooks.
- Ordering a cookbook's members by hand. A cookbook is a set, not a sequence.
- Uploading a cover, or a description. The cover is derived from the members.
- Cookbooks in a [Recipe Archive](./recipe-archive.md). An archive is an
  exchange of recipe content, so cookbooks stay behind.
- Sharing a cookbook by link. Recipe share links are unaffected.
- Cookbooks on the mobile app, for now.
