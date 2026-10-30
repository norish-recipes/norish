---
sidebar_position: 7
title: Admin settings
description: What the server owner and admins can change from the app.
---

# Admin settings

Server settings are managed under **Settings => Admin**.
Most changes apply right away. Settings that need a restart have a badge
saying so.

- [Users](./users.md)
- Registration, whether new accounts are allowed
- [Permissions](#permissions) for recipes and ingredients
- Sign-in providers
- OIDC claim mapping for admin roles and household auto-join
- Content detection: units, [ingredient words](#ingredient-words), content
  indicators and recurrence
- [Page renderers](./parser.md#page-renderers), the browsers imports read pages with
- AI and video processing, see [AI provider](./ai-provider.md)
- The [job queues](#job-queues)
- The scheduler and a server restart

## Permissions

**Recipes** sets who may view, edit and delete a recipe someone else added:
everyone, the household, or only the owner.

**Ingredients** sets who may edit an ingredient someone else added. The whole
server shares one [ingredient catalogue](../groceries/ingredients.md).

- **Everyone**: any signed-in user.
- **Household**: the person who added it and their household. This is the
  default.
- **Owner only**: only the person who added it.

Merging two ingredients needs permission on both. Anyone can add a translation.

## Ingredient words

**Content detection => Ingredient words** holds the words Norish uses to find
the food in an ingredient line. Each locale has its own lists, and Norish reads
every recipe with all of them, since it doesn't know a recipe's language.

These words are taken off the name:

- `preparation`: what was done to the food. "Finely chopped onion" is onion.
- `sizes`: "2 large onions" is onions. A size used as the unit, as in "2
  large", counts pieces.
- `approximately`: words that make an amount a guess, like "about" in "about
  200 g flour".
- `connectors`: the word between an amount and the food, like "of" in "a pinch
  of nutmeg".
- `joiners`: the word between two preparations, like "and" in "peeled and
  chopped ginger". Norish only drops it there.

These words split a line into separate foods:

- `together`: foods you need all of, like "and" in "salt and pepper". The
  grocery list gets salt and pepper.
- `alternatives`: foods where any one will do, like "or" in "butter or oil".
  The grocery list gets only the first, butter. A shorter part borrows the
  other part's words, so "cherry or grape tomatoes" is cherry tomatoes or grape
  tomatoes.

Both lists also hold symbols: "&" and "+" in `together`, "/" in
`alternatives`, also written without spaces ("salt/pepper"). Norish splits a
line only when each part is a known food, and never where it knows the whole
name ("mac and cheese").

These words help Norish read the name:

- `endsBefore`: words that start a note after the name. "Tuna in olive oil" is
  tuna, and "greek yogurt for topping" is greek yogurt.
- `forms`: cuts and forms that follow a food's name. "Chicken strips" goes
  under chicken. A cut on its own is never a food, so "carrot julienne" also
  goes under carrot.
- `notFoods`: words that never name a food on their own, like "the" or "some".
- `inflections`: plural endings and the singular ending each stands for, so
  "onions" is onion and "cherries" is cherry.

## Job queues

Imports, enrichment and other long tasks run as background jobs.
**Settings => Admin => Job queues** lists them as waiting, running, finished,
failed or cancelled. Open a job to see further details about the task.

![Job details with the models a job asked](/img/screenshots/admin-job-details.png)

### Cancelling a job

![A cancelled job in the job monitor](/img/screenshots/admin-job-cancelled.png)

A running job can be stopped from its details with **Stop**. An AI request the job is waiting on stops at once; other work finishes its current step first, and the button reads **Stopping…** until then. The job then shows as **Cancelled** and is not retried on its own; **Retry** runs it again if it was cancelled by mistake.
