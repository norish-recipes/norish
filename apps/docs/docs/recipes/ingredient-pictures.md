---
sidebar_position: 9
title: Ingredient pictures
description: Small pictures beside ingredient lines, grocery items and step ingredients, which your administrator gives each ingredient and can have drawn by AI.
---

# Ingredient pictures

A column of ingredient names is slow to scan when you recognise things by sight.
Norish can show a small picture of each ingredient beside its line, so the
coriander or the eggs can be spotted at a glance.

![A recipe's ingredient list with a picture beside each ingredient](/img/screenshots/ingredient-pictures-recipe.png)

Pictures appear:

- beside each line of a recipe's **ingredient list**, which includes cooking
  mode's ingredients view and the page someone opens from a share link;
- inside a step's **ingredient chips**;
- beside a row in the **recipe editor**, as soon as the name you typed matches;
- beside items on the **grocery list**, including ones you typed by hand, and
  while you are offline;
- beside the names in your [Pantry](../groceries/pantry.md), and beside the
  lines held back under "In your pantry" when you add a recipe.

## How a line gets its picture

Every ingredient your recipes use is kept on the server once, and your
administrator can give it a picture.

A line shows the picture of the ingredient it points at — that and nothing else.
Which ingredient that is was decided when the recipe was saved or imported: the
name you wrote is matched to an existing ingredient, ignoring capitals, and a
name nothing matches becomes an ingredient of its own. The amount and unit are
never part of the name, so `3 eggs` and `200 g eggs` are both eggs.

Because the line points at the ingredient, it also shows **that ingredient's
name**. A recipe saying "olive oil" reads "Olive Oil" if that is how your server
first recorded it.

Grocery items are different: you type them as free text, so they have no
ingredient of their own. A grocery row finds its picture by its name, ignoring
capitals, accents, punctuation and extra spaces — `Eggs!` finds `eggs`, while
`free-range eggs` is a different thing and gets no picture.

A few things follow:

- Removing a picture takes it away everywhere at once.
- Imported recipes, including [Recipe Archives](./recipe-archive.md), resolve
  their names against the ingredients your server already has.

## Suggestions in the editor

While you type an ingredient line, the editor suggests ingredient names your
recipes already use, starting with, or containing, what you have typed so far.
Every name is offered, whether or not it has a picture. Suggestions only look at
the name part of the line, after the amount and unit.

![The editor suggesting an ingredient while typing a line](/img/screenshots/ingredient-pictures-editor.png)

- Click a suggestion, or use the arrow keys and press **Enter** or **Tab**, to
  replace just the name. The amount and unit you typed stay as they are.
- Press **Enter** without choosing a suggestion to move to the next line, as
  always.
- Suggestions are optional. Any other name is saved exactly as you typed it, and
  pasting a whole ingredient list works as before.

## Hiding the pictures

If you would rather not see them on a device, hide **Ingredient pictures**
under Settings => User => [Hidden Items](./hidden-items.md). Like every Hidden
Item, this changes only your own view on that device.

## Managing ingredients

Administrators manage ingredients under Settings => Admin => **Ingredients**.
Choose **Manage ingredients** to see every ingredient name your recipes use,
with how many recipes use each. Search by name to find one.

![The Ingredients panel](/img/screenshots/ingredients-admin-panel.png)

Edit an ingredient to change:

- **Name**, which is the text recipes show. Renaming changes it in every recipe
  that uses it, and the editor tells you how many that is first. A name can only
  belong to one ingredient, so a rename onto a name another ingredient already
  has is refused, naming that ingredient.
- **Picture**, uploaded, pasted from the clipboard, or drawn by the image model.
  Pictures are cropped to a square.

![Editing an ingredient: its name and picture](/img/screenshots/ingredients-admin-editor.png)

**Add ingredient** creates a name no recipe uses yet, so it can have a picture
ready ahead of time. An ingredient can only be deleted when no recipe uses it and
no household keeps it in a pantry; otherwise Norish tells you what still does.

### Drawing pictures with AI

When [Image Generation](../configuration/ai-provider.md#image-generation) is
configured, **Generate** has the image model draw the ingredient from its name.
A drawing takes a moment and appears in the panel when it is ready. Generating
again replaces the picture.

**Generate missing pictures** draws every ingredient without a picture that a
recipe uses. It tells you how many pictures that is before it starts, because
each one is a separate request to your image provider. Ingredients already being
drawn are not drawn twice.

Every picture is drawn from the **Ingredient Illustration Prompt**, which sets
the style they share. You can edit it under Settings => Admin => AI &
Processing => Prompts. Changing it affects pictures drawn afterwards, not the
ones you already have.
