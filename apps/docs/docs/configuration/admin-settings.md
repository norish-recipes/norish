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

## Ingredient words

**Content detection => Ingredient words** lists the words Norish ignores when
it matches an ingredient name to a food. The list is per locale:

- `preparation`: how a food is prepared, like "chopped" or "diced"
- `sizes`: like "large" or "small"
- `approximately`: like "about"
- `connectors`: words between a measure and the food, like "of" in "a pinch of
  nutmeg"
- `joiners`: words between two preparations, like "and" in "peeled and
  chopped"
- `together` and `alternatives`: words between two foods, like "en" in "zout
  en peper" and "of" in "boter of olie". "&" and "+" are "and", "/" is "or",
  also written without spaces ("salt/pepper"). A recipe line is split there only
  when each part is a known food, and never where Norish knows the whole name
  ("mac and cheese")
- `endsBefore`: where a name ends, like "in" in "tuna in olive oil", which is
  tuna, or "for" in "greek yogurt for topping"
- `forms`: cuts and forms after a food's name, like "blokjes" in "mango
  blokjes". A new ingredient named so is filed under the food. A cut alone is
  never a parent, so "peen julienne" goes under carrot
- `notFoods`: words that are never a food on their own, like "and" or "with"
- `inflections`: plural and diminutive endings, so "onions" becomes "onion" and
  "cherries" becomes "cherry"

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

## Job queues

Imports, enrichment and other long tasks run as background jobs.
**Settings => Admin => Job queues** lists them as waiting, running, finished,
failed or cancelled. Open a job to see further details about the task.

![Job details with the models a job asked](/img/screenshots/admin-job-details.png)

### Cancelling a job

![A cancelled job in the job monitor](/img/screenshots/admin-job-cancelled.png)

A running job can be stopped from its details with **Stop**. An AI request the job is waiting on stops at once; other work finishes its current step first, and the button reads **Stopping…** until then. The job then shows as **Cancelled** and is not retried on its own; **Retry** runs it again if it was cancelled by mistake.
