---
sidebar_position: 7
title: Admin settings
description: Settings admin and the server owner may manage.
---

# Admin settings

A lot of the settings are configurable during runtime, some settings
may require a server restart, this is always indicated.

Server owners/admins can see these in: **Settings => Admin**.

On this page you can manage:

- **[Users](./users.md)** Basic user management.
- **Registration policy** If new accounts are allowed.
- **[Permissions](#permissions)** for recipe view, edit, and delete scopes.
  And for editing ingredients.
- **Auth providers** Basic auth, and SSO settings.
- **OIDC claim mapping** for admin role assignment and household auto-join.
- **Content detection settings** (units, [ingredient words](#ingredient-words),
  content indicators, recurrence config).
- **AI and video processing settings**.
- **[Job queue](#job-queue)** Debug information about background jobs.
- **System scheduler** and server restart actions.

## Ingredient words

**Settings => Admin => Content detection => Ingredient words** holds words
that are ignored when matching ingredient names to a food. This is a per language set:

- `preparation`: How a food comes prepared: (“chopped”, "diced");
- `sizes`: Indicators of how large an ingredient is: (“large”, “small”);
- `approximately`: Words such as: (“about”);
- `connectors`: Words between a measure and the food (“a pinch **of** nutmeg”);
- `joiners`: Words between two preparations (“peeled **and** chopped”);
- `servedWith`: What the food served with or in (“tuna **in** olive oil” is tuna);
- `notFoods`: Joining words such as: (“and”, “with”);
- `inflections`: Plural and diminutive endings “onions” becomes “onion“, “cherries“ becomes “cherry“.

## Permissions

**Settings => Admin => Permissions** The different option for permissions and view policies.

**Recipes** has a level for viewing, editing and deleting a recipe someone else
added: everyone, household or owner only.

**Ingredients** has three options as every household shares one catalogue of
ingredients, which members look after in **Settings => Ingredients**. This
decides who may edit an ingredient someone else added.

- **Everyone**: any signed-in user.
- **Household** (the default): whoever added it and their household members.
- **Owner only**: only whoever added it.

**Merging needs permission on both ingredients**. Anyone may add a translation to any ingredient.

## Job queue

![Job details with the models a job asked](/img/screenshots/admin-job-details.png)

Most tasks executed in Norish are run in the background via queues.
You can view these queues and their steps in: **Settings => Admin => Job queues**
A queue has the following states: waiting, running, finished or failed.
Opening a job shows details for debugging purposes.
