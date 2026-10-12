---
sidebar_position: 5
title: Recipe enrichment
description: Auto tagging, allergy indicators, Nutrition estimates, image generation.
---

# Recipe enrichment

When your the instance has AI enabled, it can automatically do the following actions:

- **Tagging**:
- **Allergy indications**: These are tags that match allergies you or you household members have set
- **Meal categories**: Breakfast, Lunch, Dinner, Snack
- **Nutrition**: calories, fat, carbs, and protein per serving
- **[Provenance](./provenance.md)**: where the recipe comes from: its country,
  region, cuisines, and a short written explanation
- **[Step ingredients](./step-ingredients.md)**: which ingredient lines each
  step uses.
- **Image generation**: an generated photo for recipes that have no
  image at all. and [image provider](../configuration/ai-provider.md#image-generation) is needed.

Enrichtments always run after a recipe has been imported.

### Supplied data

Information you entered yourself, or that the source stated explicitly, outranks automatic enrichment.
The following rules apply:

- **Catorization**: Any meal detecxted category stops automatic categorization.
- **Nutrition estimation** When the source has a complete list of macros no estimation is run.
  On an incomplete list the estimation is run regardless. When the source matches nothing and Norish
  has more tan 80% of the database itself the macros are calculated without AI. With less than 80%,
  the facts Norish does have are sent to the provider to estimate the rest.
- **Recipe provenance** If the source states anything about this the run is skipped.
- **Ingredient linking** Ingredient linking is done per step line. Any lines you did yourself are ignored.
  [Step ingredients](../recipes/step-ingredients.md#letting-ai-fill-the-gaps).
- **Image generation** For most sources this will be skipped, if anything is present that will be used.
- **Tags and allergy indications** Are different: for these they append but
  never remove what is present.

## Individual enrichments

Each of the enrichments can also be run manually under the quick actions menu of a recipe (**⋯**).

- **Auto-tag**
- **Detect allergies** shown when your household has allergies configured
- **Auto-categorize**
- **Estimate nutrition**
- **Work out provenance**
- **Link ingredients to steps**
- **Generate Picture** needs an
  [image provider](../configuration/ai-provider.md#image-generation) configured

These options remain available even when automatic enrichments is off. All that needs to be configured
is an AI provider.

:::warning
**Generate Picture replaces the recipe's primary image**
:::
