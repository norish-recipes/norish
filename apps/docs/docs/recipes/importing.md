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

Video links from YouTube, Instagram, TikTok and other sites import too when
[video import](../configuration/ai-provider.md#video-import) is set up.

## While browsing

**Settings => User => Import while browsing** gives you a bookmarklet, a
bookmark that sends the page you're on to Norish. It works in any desktop
browser, including Safari.

1. Drag **Save to Norish** to your Favorites or bookmarks bar. If your browser
   won't let you, press **Copy**, bookmark any page, edit that bookmark and
   replace its address with what you copied.
2. On a recipe page, click the bookmark. Norish opens in a new tab and starts the
   import.

The bookmarklet holds a private code tied to your account, so treat it like a
bookmark only you use. A link to the import page without that code shows the
recipe and waits for you to press **Import**, so another website can't add
recipes to your library by sending you there.

On Android, install Norish as an app to see it in the share sheet. Chromium and
Firefox can also use the community
[Norish Quick Import](https://github.com/AfoxDesignz/Norish-Quick-Import-Extension)
extension.

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
