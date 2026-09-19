---
sidebar_position: 4
title: Recipe provenance
description: Where a recipe comes from, its country, region, cuisines, and a short explanation, how Norish works that out, and how to curate the cuisine list.
---

# Recipe provenance

Provenance is where a recipe comes from. Norish records four things:

- **Country**, the country the dish comes from
- **Region**, a finer-grained region within it, when the dish warrants one
- **Cuisines**, the culinary traditions it belongs to; a fusion dish can have
  several
- **Note**, a couple of sentences explaining how that was concluded

The country is that section's own heading with its flag, and named **in the recipe's language**, the same
language as the note beside it: a Dutch recipe about a Turkish dish is titled
_Turkije_. Recipes placed before this name existed fall back to the country's
own name for itself until a run stores one. Until there is a country at all,
the section simply calls itself **Provenance**. The region and the note are
shown exactly as written.

A dish that several countries claim still gets a country: Norish picks the
single strongest claim and acknowledges the rivals in the note. Only a dish
that belongs to no national tradition at all keeps an empty country, an
honest blank rather than an invented answer.

The flag also flies in front of the recipe's title, and beside every recipe on
your dashboard, so you can see at a glance where a dish comes from.

![Recipe provenance on a recipe page](/img/screenshots/provenance-recipe.png)

If a recipe has no provenance and nothing is running, the section simply isn't
there.

## The note is in the recipe's language

The explanation is written in the language **the recipe itself** is written in,
not yours. An Italian recipe gets an Italian note beside its Italian steps; a
Dutch recipe gets a Dutch one. The note is recipe content, like the steps and
the ingredients, and is never translated.

## Cuisines are a list your administrator owns

Unlike tags, which anyone can invent, cuisines come from a curated list that
your instance's administrator maintains. Norish ships with a starting list, and
your administrator can add to it, rename entries, or remove them under
**Settings => Admin => AI & Processing => Cuisines**.

![Managing the Cuisine vocabulary in admin settings](/img/screenshots/admin-cuisines.png)

- **Renaming** a cuisine updates every recipe using it at once.
- **Deleting** one removes it from every recipe that had it. Notes written
  earlier may still mention it; Norish leaves them alone.
- Cuisine names are shown exactly as your administrator wrote them, in every
  language. If you want them in your own language, rename them.

| Cuisine strategy            | What AI may do                                      |
| --------------------------- | --------------------------------------------------- |
| **Only existing cuisines**  | Pick from your list; anything else is discarded     |
| **AI can add new cuisines** | Pick from your list, or add an entry that's missing |

The default is **only existing cuisines**.

## Automatic and on-demand

Provenance is one of the kinds of [recipe enrichment](./enrichment.md), so it
behaves like the others:

- Your administrator turns **Recipe Provenance** on or off for new recipes under
  **Settings => Admin => AI**. It is **off by default**, so upgrading never starts
  spending AI on its own.
- You can ask for it yourself at any time from a recipe's actions menu
  (**Work Out Provenance**), whether or not the automatic switch is on.
- An automatic run **fills in only what is missing** and never touches what you
  or your import source provided, see below.
- A run you ask for **replaces the whole group**, country, region, cuisines,
  and note together, because a deliberate refresh shouldn't be half-blocked by
  a value you no longer want.

## Your own answer wins

Whatever is already filled in, a country you picked, a cuisine your import
source stated, a note you wrote, is never overwritten by automatic inference.
Instead, inference works **around** your answer: import a recipe that only
carries a cuisine and it still gets its country, region, and note. Your values
are handed to the AI as settled facts, so the explanation it writes accounts
for them rather than arguing with them.

Once the group is complete, a country, a note, and at least one cuisine,
automatic inference leaves the recipe entirely alone. A missing region never
triggers a run by itself: many dishes are national rather than regional, so an
empty region is an answer, not a gap.

![Editing recipe provenance in the recipe form](/img/screenshots/provenance-form.png)

:::note
Emptying provenance does not re-arm automatic inference, automatic enrichment is
enrolled once, when a recipe is new. Empty it, then ask for a run, or an
administrator's **Enrich All Recipes** will fill the gaps on its next pass.
:::
