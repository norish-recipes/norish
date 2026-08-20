---
sidebar_position: 6
title: Recipe Archive
description: Export every recipe you can see as one portable .norishrecipes file, and import it back into any Norish instance. What travels with a recipe, what deliberately does not, and why an archive is portability rather than backup.
---

# Recipe Archive

A **Recipe Archive** is a single portable file, `norish-recipes-2026-08-16.norishrecipes`,
holding every recipe you can see, each one complete with its photos and videos.
Norish reads it back through the same import door it uses for Mela, Paprika,
Mealie and Tandoor exports, so moving a collection to a fresh instance, keeping
an off-instance copy, or handing your recipes to a friend is one button and one
file.

Export is the verb; the file is the archive.

## Exporting your own recipes

Go to **Settings → User**, find the **Export Recipe Archive** card, and press
**Export**. The download starts immediately and streams as the file is built,
so nothing is prepared on the server first and nothing is left behind on it
afterwards.

The button stays busy for as long as the transfer runs and counts up the bytes
that have arrived, which is worth watching for a large library. A video-heavy
instance export can take a while; because the archive is never assembled
anywhere first, there is no size to show a percentage against.

![The Export Recipe Archive card in user settings](/img/screenshots/recipe-archive-user-export.png)

What lands in the archive is exactly what your library shows you under the
server's view policy: your own recipes, the ones your household shares with you,
and any orphaned recipes whose owner has been removed. The file is named with
the date, so successive exports sit beside each other instead of overwriting one
another.

## Exporting the whole server

A server administrator gets the same button in **Settings → Admin**, under
**General**, where it covers every recipe on the instance regardless of who owns
it. It takes a full content snapshot: useful before a risky change, or when
winding an instance down and handing the recipes on.

![The instance-wide export in admin settings](/img/screenshots/recipe-archive-admin-export.png)

It is the same operation and the same file format as the personal export, only
with a wider scope. There is no privileged extra data behind the admin button,
and the server checks the permission itself: a non-administrator cannot reach
the instance-wide export by any route.

## Importing an archive

Drop the `.norishrecipes` file on the **Import Recipe Archive** card, the same
place you would drop a Mela or Mealie export. Progress, duplicate handling and
per-recipe error reporting all work the way they already do for every other
format.

Two things are worth knowing about how an import lands:

- **The recipes become yours.** Whoever imports an archive owns everything it
  creates. The original author's display name travels as attribution so you can
  still tell whose recipe it was, but ownership does not transfer.
- **A matching recipe is overwritten, not duplicated.** A recipe is matched by
  its URL or its name within your household, so re-importing your own archive
  into the same instance updates your library rather than doubling it. The flip
  side: importing an old archive replaces edits you have made since you exported
  it.

Your rating and your favourite mark travel with each recipe and are applied to
whichever recipe wins the match, so the marks you made survive a move.

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

If you want a restorable copy of a running Norish instance, back up the database
and the uploads directory. An archive will not do that job and does not try to.

## Cuisines that the receiving server does not know

Cuisine names travel as words, because a cuisine's identifier only means
something on the instance that issued it. On import, each name is matched
against the receiving server's own cuisine list, ignoring capitalisation:

- A name the list already knows is attached to the recipe.
- A name it does not know is **dropped**, and reported in the import summary as
  an import note, so you can see what the import chose not to keep. The recipe
  itself still imports: a note says what a recipe lost, never that it was
  passed over.

Unknown cuisines are never created and never turned into tags. The cuisine list
belongs to the server's administrator, and an imported file is not allowed to
extend it. If the recipe ends up missing its provenance, the receiving server's
own [Recipe enrichment](./enrichment.md) can fill that gap back in under its own
rules.

## Archives from other versions

The archive identifies itself from the inside, so Norish recognises one whatever
it has been renamed to, and it carries a format version. An archive written by a
newer major version of the format than your Norish understands is refused with a
clear message and imports nothing at all, rather than half-importing something
it only half-understands. Within a version, fields your Norish does not
recognise are ignored, so newer archives keep working as the format grows.

A recipe entry that is corrupt or unreadable fails on its own, with an error
naming it, while the rest of the archive imports normally.
