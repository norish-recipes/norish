---
sidebar_position: 1
title: Recipe imports and exports
description: Import recipes from links, text, photos or archives, and export recipe archives.
---

# Recipe imports and exports

## From a link

In **Add Recipe**, choose **URL**, enter the link and select **Import**. You
can also paste the link into the dashboard search bar. In Chromium browsers,
allow clipboard access to get a prompt when you copy a link.

![Norish asking to import a copied link](/img/screenshots/import-clipboard-prompt.png)

Enable [video import](../configuration/ai-provider.md#video-import) to import links
from YouTube, Instagram or TikTok.

## From pasted text or photos

In **Add Recipe**, select **Paste** for plain text or
[JSON-LD](https://schema.org/Recipe). Select **Image** for up to 10 images
or PDF pages per recipe.

:::note
Plain text and images require an [AI provider](../configuration/ai-provider.md).
:::

## Recipe archives {#recipe-archives}

:::warning
An import can overwrite recipes in your household. Norish matches by URL, or
by name if either recipe has no URL.
:::

In account settings, drop a file on **Import recipe archive**. Norish accepts
archives from Norish, Mela, Paprika, Mealie, Tandoor and Recipe Keeper. For
Recipe Keeper, use the `RecipeKeeper_….zip` file.

Choose **Export** under **Export recipe archive** to save all recipes you
can see, including photos and videos. Administrators can export all recipes
on the server under **General** in admin settings. Use a server backup to
preserve accounts, settings, meal plans and groceries.

For scripted imports, see the [API reference](../reference/api.mdx#recipeimporturl).
