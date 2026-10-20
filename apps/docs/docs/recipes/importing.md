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
Without one, the **Image** menu item and the **Bulk images** button are not visible.
:::

## Several recipes from images

**Bulk images** in the Library header opens a screen that imports many images
at one time, with one recipe for each image. It is a fast way to copy a set of
recipe images or cookbook pages.

1. Choose up to 10 JPG, PNG, or WebP images, 10 MB each and 40 MB in total.
   Each image becomes a recipe, so choose images that hold different recipes.
2. Press the import button. It shows the number, for example **Import 2
   recipes**. The screen reads every image separately.
3. Follow the progress list. Each image shows **Queued**, **Reading image**,
   **Recipe created**, or **Failed**.
4. Open the recipe that the import makes from its link in the list.
5. If an image failed, press **Retry**. Norish keeps the image for 24 hours, so
   you do not need to choose it again. If the server does not accept the type
   or size of an image, choose a different image.

A failed image does not stop the other images in the batch. The recipe keeps
the source image as its recipe image, as the one-image import does.

## From another app

Exports from Mela, Paprika, Mealie, Tandoor and Recipe Keeper import as a
whole, see [Recipe Archive](./recipe-archive.md#importing-an-archive).
