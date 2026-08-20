---
sidebar_position: 6
title: Recipe Archive
description: Export every recipe you can see as one portable .norishrecipes file, and import it back into any Norish instance. What travels with a recipe, what deliberately does not, and why an archive is portability rather than backup.
---

# Recipe Archive

A **Recipe Archive** is a single portable file, `norish-recipes-2026-08-16.norishrecipes`,
holding every recipe you can see, each one complete with its photos and videos.

Currently this feature is limited to just recipes this is **NOT** a backup.

## Exporting your own recipes

Go to **Settings => User**, find the **Export Recipe Archive** card, and press
**Export**.

![The Export Recipe Archive card in user settings](/img/screenshots/recipe-archive-user-export.png)

The archive is limited to all recipes you have access to. Not just your own recipes.

## Exporting the whole server

A server administrator gets the same button in **Settings => Admin**, under
**General**, where it covers every recipe on the instance regardless of who owns
it. It takes a full content snapshot: useful before a risky change, or when
winding an instance down and handing the recipes on.

![The instance-wide export in admin settings](/img/screenshots/recipe-archive-admin-export.png)

It is the same operation and the same file format as the personal export, only
with a wider scope. There is no privileged extra data behind the admin button.

## Importing an archive

Drop the `.norishrecipes` file on the **Import Recipe Archive** card, the same
place you would drop a Mela or Mealie export. Progress, duplicate handling and
per-recipe error reporting all work the way they already do for every other
format.

Two things are worth knowing about how an import lands:

- **The recipes become yours.** Whoever imports an archive owns everything it
  creates. The original author's display name travels as attribution so you can
  still tell whose recipe it was, but ownership does not transfer.
- **Currently a matching recipe is overwritten, not duplicated.** A recipe is matched by
  its URL or its name within your household, so re-importing your own archive
  into the same instance updates your library rather than doubling it.

:::note
Matching on URL or name is easy to abuse: an archive from someone else can
overwrite a recipe in your library simply by carrying the same name. Only import
archives you trust, and check what an unfamiliar one contains before you feed it
in. A future version will make this safer.
:::

## What is deliberately not in the file

An archive is an exchange of recipe content. It is **not a backup**, and it is
not an instance migration:

- **No account data of anyone.** No emails, no avatars, no preferences, no
  households, no sign-in details. Attribution is a display name and nothing
  else, which is what makes an archive safe to post publicly or hand to a
  friend.
- **Only your own marks.** Your rating and your favourite travel; nobody else's
  ratings or favourites are in the file.
- **No instance state.** Share links, planned meals, groceries, stores,
  allergies and settings stay where they are.
