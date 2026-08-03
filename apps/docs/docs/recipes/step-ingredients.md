---
sidebar_position: 4
title: Step ingredients
description: Each step can carry the ingredient lines it uses, with amounts computed at the moment you read them — including AI filling in the steps you haven't linked yourself.
---

# Step ingredients

A cook reading _"add the spices"_ shouldn't have to stop, scroll back to the
ingredient list, and guess which lines that means. A step in Norish can carry
**step ingredients**: the ingredient lines it uses, shown with the step as
resolved names and amounts.

- _"Add the spices"_ shows the salt, the pepper, **and** the paprika — every
  line it means.
- _"Add half the water"_ shows **25 ml water** when the water line is 50 ml —
  the arithmetic is done for you, where you need it.
- The step's own text is never rewritten. The links live beside the sentence,
  not inside it.

![Amounts under a step on the recipe page](/img/screenshots/step-ingredients-recipe.png)

Amounts are computed at the moment you read them, from the ingredient line as
it stands right now. Edit a line's amount and every step showing it follows;
switch the measurement system and the amounts switch with it; scale the
servings and they scale too. A line with no amount shows its name only.

## In cooking mode

Cooking mode shows the current step's ingredients right under the instruction —
in front of you exactly when your hands are full.

![Cooking mode showing a step's ingredients](/img/screenshots/step-ingredients-cooking-mode.png)

Share links carry them too: someone opening a recipe you shared sees the same
amounts beneath the steps, with nothing beyond the recipe's own content
exposed.

## Linking steps yourself

In the recipe form, every step has a chips row: mention an ingredient with `@`
while typing, or attach one from the **Link ingredient** picker without naming
it in the text. Each chip carries how much of its line the step uses — half, a
third, a quarter, or an exact amount when the line has one. A recipe that
calls for 5 eggs can use **3** in one step and **2** in another: pick
**Amount…** on the chip and type the number the step means. A tap removes a
chip.

An entered amount is stored as the equivalent share of its line — 3 of the
5 eggs is stored as 0.6 — which is exactly why the displayed amounts keep
following edits, the servings control, and the measurement system. Only a
line with no amount of its own is edited as a share directly. See
[Creating and editing recipes](./creating-and-editing.md) for the editor's
affordances in full.

## Letting AI fill the gaps

**Ingredient Linking** is one of the kinds of
[recipe enrichment](./enrichment.md), and it is deliberately the gentlest one:
it is a **gap-filler in every case**. Automatic or requested by hand, it only
ever adds links to steps that have none.

- Hand-link a few steps, run **Link Ingredients to Steps** from the recipe's
  actions menu, and the rest are filled in — the steps you linked yourself are
  never touched, so a rerun can never replace your work.
- Your administrator can turn **Ingredient Linking** on for newly added recipes
  under **Settings → Admin → AI**. It is **off by default**, so upgrading never
  starts spending AI on its own.
- Section headings are never linked, and a step that genuinely uses nothing —
  _"let it rest"_ — stays bare. That is a normal outcome, not an error, and a
  later run may look at that step again.
- A recipe with no ingredients or no steps has nothing to link, and the run
  skips it.

Like every enrichment kind, an automatic run that fails stays quiet, and a run
you asked for reports its failure and can simply be run again.

## Offline

Step ingredients are part of the recipe, so they travel into your offline copy
with it. An offline reader sees the same amounts a connected one does, with
nothing extra to set up.
