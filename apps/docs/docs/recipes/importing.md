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

You can also paste a link in the dashboard search bar. Norish checks whether
the page holds a recipe and imports it.

In Chromium-based browsers, Norish can offer to import a copied link on any
page once you allow clipboard access. Safari and Firefox don't allow this, so
paste the link there instead.

![Norish asking to import a copied link](/img/screenshots/import-clipboard-prompt.png)

Video links from YouTube, Instagram, TikTok and other sites import too when
[video import](../configuration/ai-provider.md#video-import) is set up.

## From pasted text or photos

- **Add Recipe => Paste** takes a recipe as plain text or as
  [JSON-LD](https://schema.org/Recipe).
- **Add Recipe => Image** reads a recipe from photos or screenshots, up to 10
  images into one recipe.

:::note
Plain text and images need an [AI provider](../configuration/ai-provider.md).
Without one, the Image option is hidden.
:::

## From another app

Exports from Mela, Paprika, Mealie, Tandoor and Recipe Keeper import as a
whole, see [Recipe Archive](./recipe-archive.md#importing-an-archive).

## Through the API

To import recipes from scripts or external tools, queue the
import with `POST /api/v1/recipes/import/url` and monitor its progress with
`GET /api/v1/recipes/import/status/{recipeId}`. The status endpoint supports
long-polling (`?wait=30`) to receive the completed recipe or failure reason in
a single request without tight polling loops. See the
[API reference](../reference/api.mdx).
