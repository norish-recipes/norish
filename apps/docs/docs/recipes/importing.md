---
sidebar_position: 1
title: Importing recipes
description: Import a recipe from a link, text, photos or another app.
---

# Importing recipes

## From a link

**Add Recipe => URL** asks for the address of a recipe page. A link on your
clipboard is filled in for you, so you copy the address, open the dialog and
press **Import**.

Paste a link in the dashboard search bar to check for a recipe and import it.

In Chromium-based browsers, allow clipboard access to receive an import
prompt for copied links on any page. Safari and Firefox don't allow this, so
paste the link there instead.

![Norish asking to import a copied link](/img/screenshots/import-clipboard-prompt.png)

The notes in a WP Recipe Maker or Tasty Recipes recipe card import into the
recipe's notes. A page with several recipe cards imports no notes, because
Norish can't tell which belong to the recipe.

![The Notes card on a recipe imported from a link](/img/screenshots/import-recipe-notes.png)

Video links from YouTube, Instagram, TikTok and other sites import too when
[video import](../configuration/ai-provider.md#video-import) is set up.

## From pasted text or photos

- **Add Recipe => Paste** takes a recipe as plain text or as
  [JSON-LD](https://schema.org/Recipe).
- **Add Recipe => Image** reads a recipe from photos, screenshots or a PDF, up
  to 10 images or PDF pages into one recipe.

:::note
Plain text and images need an [AI provider](../configuration/ai-provider.md).
Without one, the Image option is hidden.
:::

## From another app

Exports from Mela, Paprika, Mealie, Tandoor and Recipe Keeper import as a
whole, see [Recipe Archive](./recipe-archive.md#importing-an-archive).

## Through the API

Scripts and other tools import a link with `POST /api/v1/recipes/import/url`,
which returns a `statusUrl`. `GET /api/v1/recipes/import/status/{recipeId}`
says whether the import is waiting, running, done or failed, with the recipe or
the reason. Add `?wait=30` to hold the request until the import ends, for up to
60 seconds. See the [API reference](../reference/api.mdx).
