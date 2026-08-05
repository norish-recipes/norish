---
sidebar_position: 2
title: Recipe enrichment
description: How Norish adds tags, allergy indications, meal categories, nutrition, provenance, and step ingredients to your recipes with AI, and how to run each one yourself.
---

# Recipe enrichment

When your Norish instance has AI enabled, it can fill in six things about a
recipe:

- **Tags**: descriptive keywords such as _quick_, _one-pot_, _vegetarian_
- **Allergy indications**: tags for the allergies your household has configured
- **Meal categories**: Breakfast, Lunch, Dinner, Snack
- **Nutrition**: calories, fat, carbs, and protein per serving
- **[Provenance](./provenance.md)**: where the recipe comes from: its country,
  region, cuisines, and a short written explanation
- **[Step ingredients](./step-ingredients.md)**: which ingredient lines each
  step uses, for the steps you haven't linked yourself

This is called _enrichment_, and it always happens **after** your recipe is
saved. Importing or creating a recipe never waits for it, and never fails
because of it. If AI is unavailable or an enrichment doesn't work out, you still
have your recipe, enrichments can always be rerun after the recipe is make manually.

## Automatic enrichment

Your administrator chooses which of the six run automatically for newly created
recipes. Whatever they choose applies the same way to every recipe you create,
whether you typed it in yourself or imported it from a link, a photo, or pasted
text.

Automatic enrichment runs once, when the recipe is new. Editing a recipe later
never re-runs it, so an edit can't unexpectedly replace values you just set.
An administrator can catch older recipes up with **Enrich All Recipes** in the
admin settings, which runs the enabled kinds across the whole library under
these same rules.

### Your own data comes first

Anything you entered or that the source you imported from stated explicitly
takes precedence:

- If the recipe already has a meal category, automatic categorization is skipped.
- If it has **complete** nutrition — calories, fat, carbs, and protein all
  present (zeros count) — automatic nutrition estimation is skipped. A recipe
  with only some of the four, say just calories from an imported page, is
  estimated and the whole group replaced, so the values always agree with each
  other instead of mixing a supplied figure with an estimate.
- If it has any provenance at all — a country, a region, a cuisine, or a note —
  automatic provenance inference is skipped for the whole group, so the note
  never ends up arguing against a country you set yourself.
- Tags and allergy indications are only ever **added**. Enrichment never removes
  a tag you added.
- Step ingredients are filled **per step**: a step you linked yourself is never
  touched, whoever asks see [Step ingredients](./step-ingredients.md).

## Running one yourself

Open a recipe and use the actions menu (**⋯**). While AI is enabled and you can
edit the recipe, you'll find one action per kind:

- **Auto-tag**
- **Detect allergies** — shown when your household has allergies configured
- **Auto-categorize**
- **Estimate nutrition**
- **Work out provenance**
- **Link ingredients to steps**

These stay available even when your administrator has turned the matching
automatic switch off, the switch controls background work, not what you can ask
for. Each action is separate on purpose: asking for categories doesn't also
spend an AI request on tags.

## States

Each kind reports its own state, independently of the others:

| State          | Meaning                                                 |
| -------------- | ------------------------------------------------------- |
| **Queued**     | Accepted and waiting for a worker                       |
| **Processing** | A worker is running it now                              |
| **Succeeded**  | Finished; the recipe on screen already shows the result |
| **Failed**     | Gave up after retrying                                  |

:::note
Enrichment history follows your instance's job retention settings. Once a
finished or failed job ages out, that kind simply shows no state again.
:::
