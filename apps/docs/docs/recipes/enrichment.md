---
sidebar_position: 5
title: Recipe enrichment
description: Let AI add tags, allergies, categories, nutrition, provenance, step ingredients and images.
---

# Recipe enrichment

With AI set up, recipes can be enriched with:

- **Tags**
- **Allergy tags** for the allergies set in your household
- **Meal categories**: breakfast, lunch, dinner or snack
- **Nutrition**: calories, fat, carbs and protein per serving
- **[Provenance](./provenance.md)**: country, region, cuisines and a short note
- **[Step ingredients](./step-ingredients.md)**: which ingredients each step
  uses
- **Image**: a generated photo for recipes without one, which needs an
  [image provider](../configuration/ai-provider.md#image-generation)

Your administrator chooses which of these run on every new recipe, see
[Automatic enrichment](../configuration/ai-provider.md#automatic-enrichment).

## What enrichment leaves alone

Anything you entered, or that the source stated, wins over an automatic run:

- **Categories**: a recipe with any meal category is left alone.
- **Nutrition**: a recipe that states all four values is left alone. Otherwise,
  when nutrition data covers more than 80% of the ingredients, values are
  calculated without AI. Below that, the AI estimates what is missing.
- **Provenance**: only the missing parts are filled in, around what is there.
- **Step ingredients**: only steps without ingredients get them.
- **Image**: only recipes without any image get one.
- **Tags and allergy tags** are only ever added, never removed.

## Running one yourself

The recipe's actions menu (**⋯**) runs each enrichment on demand, also when the
automatic switch is off. This only needs an AI provider.

- **Auto-tag**
- **Detect Allergies**, when your household has allergies set
- **Auto Categorize**
- **Estimate Nutrition**
- **Work Out Provenance**
- **Link Ingredients to Steps**
- **Generate Picture**, which needs an
  [image provider](../configuration/ai-provider.md#image-generation)

A run you start yourself replaces the current categories, nutrition or
provenance. Step ingredients you linked yourself are kept.

:::warning
**Generate Picture** replaces the recipe's main image.
:::
