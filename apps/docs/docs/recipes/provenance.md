---
sidebar_position: 2
title: Recipe provenance
description: Where a recipe comes from — its country, region, cuisines, and a short explanation — how Norish works that out, and how to curate the cuisine list.
---

# Recipe provenance

Provenance is where a recipe comes from. Norish records four things:

- **Country** — the country the dish comes from
- **Region** — a finer-grained region within it, when the dish warrants one
- **Cuisines** — the culinary traditions it belongs to; a fusion dish can have
  several
- **Note** — a couple of sentences explaining how that was concluded

It appears in its own section on the recipe page. The country is shown with its
flag and named **in your own language**, because Norish stores the country code
rather than a name. The region and the note are shown exactly as written.

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
**Settings → Admin → AI & Processing → Cuisines**.

![Managing the Cuisine vocabulary in admin settings](/img/screenshots/admin-cuisines.png)

- **Renaming** a cuisine updates every recipe using it at once.
- **Deleting** one removes it from every recipe that had it. Notes written
  earlier may still mention it; Norish leaves them alone.
- Cuisine names are shown exactly as your administrator wrote them, in every
  language. If you want them in your own language, rename them.

When AI works out a recipe's provenance, it is given your list to choose from,
and its answers are matched against it before anything is saved — so a slight
misspelling lands on the entry that already exists instead of creating a
near-duplicate. Whether AI may add entries at all is a separate setting:

| Cuisine strategy            | What AI may do                                      |
| --------------------------- | --------------------------------------------------- |
| **Only existing cuisines**  | Pick from your list; anything else is discarded     |
| **AI can add new cuisines** | Pick from your list, or add an entry that's missing |

The default is **only existing cuisines**.

## Automatic and on-demand

Provenance is one of the kinds of [recipe enrichment](./enrichment.md), so it
behaves like the others:

- Your administrator turns **Recipe Provenance** on or off for new recipes under
  **Settings → Admin → AI**. It is **off by default**, so upgrading never starts
  spending AI on its own.
- You can ask for it yourself at any time from a recipe's actions menu
  (**Work Out Provenance**), whether or not the automatic switch is on.
- A run you ask for **replaces the whole group** — country, region, cuisines,
  and note together — because a deliberate refresh shouldn't be half-blocked by
  a value you no longer want.

## Your own answer wins

Provenance is one group, and it is treated as one. If you fill in **any** part of
it — just the country, just a cuisine, just the note — automatic inference skips
that recipe entirely and never overwrites what you wrote.

That is deliberate: the note explains the whole claim, so letting AI fill in the
cuisines beside a country you set yourself would leave a paragraph arguing
against the field next to it.

You can edit provenance in the recipe form, under **Provenance**. Cuisines are
picked from your administrator's list, so what you choose matches what AI would
have chosen. **Clear provenance** empties the whole group in one go.

![Editing recipe provenance in the recipe form](/img/screenshots/provenance-form.png)

:::note
Clearing provenance does not re-arm automatic inference — automatic enrichment is
enrolled once, when a recipe is new. Clear it, then ask for a run.
:::

## Cuisines used to be tags

Ten cuisines used to be part of the predefined tag list — `italian`, `thai`,
`mexican`, and so on. They now live in the cuisine list instead, and upgrading
moves them across automatically: a recipe tagged `italian` gains the **Italian**
cuisine and loses the tag.

Only tags that match the shipped cuisine list are moved. Cuisine-like tags you
typed yourself, such as `sicilian` or `tex-mex`, are yours and stay exactly where
they are.

## Offline

Provenance is part of the recipe, so it travels into your offline copy with it.
An offline reader sees exactly what a connected one does, with nothing extra to
set up.
