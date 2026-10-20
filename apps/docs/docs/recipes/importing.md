---
sidebar_position: 1
title: Importing recipes
description: Import a recipe from a link, text, photos or another app.
---

# Importing recipes

The URL, Paste and Image options have an **Enhanced** switch. It starts from
the **Enhanced** setting in **Settings => User => Preferences**. This setting
is on at the start. Turn the switch off for one import. The setting does not
change. See
[Recipe enrichment](./enrichment.md#choosing-what-a-new-recipe-gets).

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
