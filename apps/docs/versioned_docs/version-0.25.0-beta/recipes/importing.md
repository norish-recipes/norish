---
sidebar_position: 1
title: Importing recipes
description: Importing recipes into Norish
---

# Importing recipes

The most important feature in Norish is the abillity to import
a recipe regardless of source.

## From a link

If norish has the permissions to view your clipboard it can auto-detect when
an URL is in it and request to import it. This works on any page. This feature
is limited to chromeium based browsers. Safari and Firefox only
work when pasting, this can be in the search bar on the dedicated modal.

![Norish asking to import a copied link](/img/screenshots/import-clipboard-prompt.png)

**Add Recipe => URL** asks for the address of a recipe page. A link already on
your clipboard is prefilled, so the usual round trip is: copy the
address, open the dialog, press **Import**.

**Dashboard => Search bar** Paste any URL in the dashboards searchbar and Norish
will check of that URL is a recipe and attempt to import it.

## From pasted text or a photo

- **Add Recipe => Paste** takes a recipe as plain text or in [JSON-LD](https://schema.org/Recipe) format.
- **Add Recipe => Image** turns an image into a recipe, Norish can combine up to 10 images into a single recipe.

:::note
Using free text or a images requires an AI provider setup.
If no AI provider is setup the import from image option does not show.
:::
