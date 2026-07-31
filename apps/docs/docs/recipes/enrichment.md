---
sidebar_position: 1
title: Recipe enrichment
description: How Norish adds tags, allergy indications, meal categories, nutrition, and provenance to your recipes with AI, and how to run each one yourself.
---

# Recipe enrichment

When your Norish instance has AI enabled, it can fill in five things about a
recipe:

- **Tags** — descriptive keywords such as _quick_, _one-pot_, _vegetarian_
- **Allergy indications** — tags for the allergies your household has configured
- **Meal categories** — Breakfast, Lunch, Dinner, Snack
- **Nutrition** — calories, fat, carbs, and protein per serving
- **[Provenance](./provenance.md)** — where the recipe comes from: its country,
  region, cuisines, and a short written explanation

This is called _enrichment_, and it always happens **after** your recipe is
saved. Importing or creating a recipe never waits for it, and never fails
because of it. If AI is unavailable or an enrichment doesn't work out, you still
have your recipe — exactly as it was saved.

## Automatic enrichment

Your administrator chooses which of the five run automatically for newly created
recipes. Whatever they choose applies the same way to every recipe you create,
whether you typed it in yourself or imported it from a link, a photo, or pasted
text.

Automatic enrichment runs once, when the recipe is new. Editing a recipe later
never re-runs it, so an edit can't unexpectedly replace values you just set.

### Your own data comes first

Anything you entered — or that the source you imported from stated explicitly —
takes precedence:

- If the recipe already has a meal category, automatic categorization is skipped.
- If it has any nutrition value at all, automatic nutrition estimation is
  skipped for all four fields, so a partial figure you supplied is never mixed
  with an estimate.
- If it has any provenance at all — a country, a region, a cuisine, or a note —
  automatic provenance inference is skipped for the whole group, so the note
  never ends up arguing against a country you set yourself.
- Tags and allergy indications are only ever **added**. Enrichment never removes
  a tag you added.

This holds even when the enrichment was already running: if you fill in
nutrition while an estimate is in flight, your value wins.

## Running one yourself

Open a recipe and use the actions menu (**⋯**). While AI is enabled and you can
edit the recipe, you'll find one action per kind:

- **Auto-tag**
- **Detect allergies** — shown when your household has allergies configured
- **Auto-categorize**
- **Estimate nutrition**
- **Work out provenance**

These stay available even when your administrator has turned the matching
automatic switch off — the switch controls background work, not what you can ask
for. Each action is separate on purpose: asking for categories doesn't also
spend an AI request on tags.

A run you request is a deliberate refresh, so it **replaces** the current
categories, the complete nutrition group, or the complete provenance group,
rather than deferring to what is already there. Tags and allergy indications are
still only added.

## What you'll see

Each kind reports its own state, independently of the others:

| State          | Meaning                                                 |
| -------------- | ------------------------------------------------------- |
| **Queued**     | Accepted and waiting for a worker                       |
| **Processing** | A worker is running it now                              |
| **Succeeded**  | Finished; the recipe on screen already shows the result |
| **Failed**     | Gave up after retrying                                  |

The action for a kind is disabled while that kind is queued or processing, and
becomes available again once it finishes — including after a failure, so you can
retry.

Successful enrichment updates the recipe in place, with no notification: you
simply see the new tags, categories, nutrition, or provenance appear. A run **you** asked for
shows an error if it can't start or if it ultimately fails. Automatic enrichment
is deliberately quiet — it's optional background work, so a failure shows up as
the `Failed` state on the recipe and nothing more.

If you close and reopen the recipe, or your connection drops and returns, the
states shown are re-read from the server, so you never need to have been watching.

:::note
Enrichment history follows your instance's job retention settings. Once a
finished or failed job ages out, that kind simply shows no state again.
:::
