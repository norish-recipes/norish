---
sidebar_position: 7
title: Admin settings
description: Runtime settings server owners and admins can manage from the Norish UI.
---

# Admin settings

Most of Norish is configurable at runtime from the UI, no restart or env-var
change required. Server owners/admins can see these in: **Settings => Admin**.

You can manage:

- **[Users](./users.md)** Basic user management.
- **Registration policy** whether new users may register.
- **[Permissions](#permissions)** for recipe view, edit, and delete scopes,
  and for editing ingredients.
- **Auth providers** (OIDC, GitHub, Google).
- **OIDC claim mapping** for admin role assignment and household auto-join.
- **Content detection settings** (units, [ingredient words](#ingredient-words),
  content indicators, recurrence config).
- **AI and video processing settings**.
- **[Job queue](#job-queue)** Information about background jobs and possible restarts.
- **System scheduler** and server restart actions.

:::tip
Settings that can change at runtime live here; settings needed to _boot_ the
instance, the [database](./database.md), the encryption key in
[Server & runtime](./server-runtime.md), and the initial
[auth provider](./authentication.md), are environment variables.

Some settings may require a reboot, this is indicated in the UI.
:::

## Ingredient words

**Settings => Admin => Content detection => Ingredient words** holds the words
Norish reads past when it matches an ingredient name to a food, one set per
language:

- `preparation`: what is done to a food (“chopped”, “fijngesneden”);
- `sizes`: “large”, “grote”, also counted as one piece when a line's unit is one;
- `approximately`: “about”, “ongeveer”, read past with the quantity they come with;
- `connectors`: the word between a measure and its food (“a pinch **of** nutmeg”);
- `joiners`: the word between two preparations (“peeled **and** chopped”);
- `servedWith`: what a food comes in or with (“tuna **in** olive oil” is tuna);
- `notFoods`: words that never name a food alone (“and”, “een”);
- `inflections`: plural and diminutive endings, each with the ending it stands
  for, so “onions” is onion and “bosuitjes” is “bosui”: `["ies", "y"]` reads
  “cherries” as “cherry”.

Every language's words apply to every name, since a recipe's language is not
recorded. Norish ships them for every language it speaks and updates them with
each release until you save your own; **Restore defaults** follows the shipped
words again. A change applies to names read from then on; a name already
matched keeps its food.

## Permissions

**Settings => Admin => Permissions** holds one card with a section per kind of
thing.

**Recipes** has a level each for viewing, editing and deleting a recipe someone
else added: everyone, household or owner only.

**Ingredients** has one level. Every household shares one catalogue of
ingredients, which members look after in **Settings => Ingredients**, and this
decides who may rename an ingredient someone else added, set its parent, mark it
distinct, merge it, or move or remove one of its translations:

- **Everyone**: any signed-in user.
- **Household** (the default): whoever added it and their household members.
- **Owner only**: only whoever added it.

Merging needs permission on both ingredients. Anyone may add a translation to any
ingredient. Ingredients are always visible to
everyone; there is no view setting. Ingredients from the built-in catalogue
belong to no one and only server admins can edit them, and server admins can
always edit every ingredient. An ingredient whose owner deleted their account
belongs to no one too, so it is left to server admins in the same way.

## Job queue

![Job details with the models a job asked](/img/screenshots/admin-job-details.png)

Most tasks executed in Norish are run in the background via queues.
You may view these queues and their steps in: **Settings => Admin => Job queues**
A queue has the following states: waiting, running, finished or failed.
Opening a job shows details for debugging purposes.
