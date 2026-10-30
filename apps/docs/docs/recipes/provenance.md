---
sidebar_position: 6
title: Recipe provenance
description: Where a recipe comes from, its country, region and cuisines.
---

# Recipe provenance

Provenance describes where a recipe comes from:

- **Country**
- **Region**, when the dish belongs to one
- **Cuisines**, one or more
- **Note**, a short explanation of the origin

The country's flag shows before the recipe title and beside the recipe on your
dashboard.

![Recipe provenance on a recipe page](/img/screenshots/provenance-recipe.png)

The country name and the note are in the recipe's language, not yours. A Dutch
recipe for a Turkish dish says _Turkije_. The note is never translated.

When several countries claim a dish, the strongest claim is chosen and the
others are named in the note.

## Cuisines

Cuisines come from a list your administrator keeps under
**Settings => Admin => AI & processing => Cuisines**. A starting list is
included.

![Managing the Cuisine vocabulary in admin settings](/img/screenshots/admin-cuisines.png)

- Renaming a cuisine renames it on every recipe.
- Deleting a cuisine removes it from every recipe. Older notes may still
  mention it.
- Cuisine names show as written, in every language. Rename them to use your own
  language.

The [cuisine strategy](../configuration/ai-provider.md#cuisine-strategy) decides
whether AI may add cuisines to the list. By default it may only pick from it.

## Running it

- Your administrator can turn on **Recipe provenance** for new recipes under
  **Settings => Admin => AI**. It is off by default.
- **Work Out Provenance** in a recipe's actions menu runs it any time, and
  replaces the country, region, cuisines and note together.

Automatic runs fill only missing values and keep data from you or the source. A recipe with a country, a note and at least one cuisine is left alone.

![Editing recipe provenance in the recipe form](/img/screenshots/provenance-form.png)

:::note
Clearing provenance doesn't start an automatic run. Run it yourself, or an
administrator's **Enrich** in Bulk enrichment fills it in.
:::
