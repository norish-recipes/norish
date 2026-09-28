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
- **Permission policies** for recipe view, edit, and delete scopes, and for
  [editing ingredients](#ingredient-permissions).
- **Auth providers** (OIDC, GitHub, Google).
- **OIDC claim mapping** for admin role assignment and household auto-join.
- **Content detection settings** (units, content indicators, recurrence config).
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

## Ingredient permissions

Every household shares one catalogue of ingredients, which members look after
in **Settings => Ingredients**. **Settings => Admin => Ingredient Permissions**
decides who may rename an ingredient someone else added, mark it distinct, or
remove one of its spellings:

- **Everyone**: any signed-in user.
- **Household** (the default): whoever added it and their household members.
- **Owner only**: only whoever added it.

Anyone may add a spelling to any ingredient. Ingredients are always visible to
everyone; there is no view setting. Ingredients from the built-in catalogue
belong to no one and only server admins can edit them, and server admins can
always edit every ingredient. An ingredient whose owner deleted their account
belongs to no one too, so it is left to server admins in the same way.

## Job queue

![Job details with the models a job asked](/img/screenshots/admin-job-details.png)

Most tasks executed in Norish are run in the background via queues.
You may view these queues and their steps in: **Settings => Admin => Job Queues**
A queue has the following states: waiting, running, finished or failed.
Opening a job shows details for debugging purposes.
