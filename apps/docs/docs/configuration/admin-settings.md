---
sidebar_position: 7
title: Admin settings
description: What the server owner and admins can change from the app.
---

# Admin settings

Open **Settings**, then **Admin**. A badge marks settings that require a restart.

## Permissions

Use **Recipes** to choose who can view, edit or delete someone else's recipe.
Choose everyone, the household or the owner.

**Ingredients** controls who can edit a shared catalogue entry. **Household**
is the default. Merging entries requires edit permission on both. Anyone can
add a translation.

## Shopping list

Under **General**, **Shopping list** sets where ingredients go when someone adds
them to the groceries. **Norish grocery list** is the default. **Bring!** sends
them to [Bring!](/groceries/bring) instead and hides the Groceries tab. The
setting applies to everyone straight away and deletes nothing.

Choose Bring! only if Norish is reachable from the internet over HTTPS. Bring!'s
servers fetch a temporary public HTTPS page with the recipe name, the servings and the
item lines.

## Ingredient words

In admin settings, open **Content detection**, then **Ingredient words**.
Each language has a list. Norish checks all lists when it reads an ingredient.

| Setting         | Example                                                           |
| --------------- | ----------------------------------------------------------------- |
| `preparation`   | Ignore "finely chopped" in "finely chopped onion".                |
| `sizes`         | Ignore "large" in "2 large onions".                               |
| `approximately` | Ignore "about" in "about 200 g flour".                            |
| `connectors`    | Ignore "of" in "a pinch of nutmeg".                               |
| `joiners`       | Ignore "and" between preparations in "peeled and chopped ginger". |
| `together`      | Add both foods in "salt and pepper". Also accepts `&` and `+`.    |
| `alternatives`  | Add the first food in "butter or oil". Also accepts `/`.          |
| `endsBefore`    | Read "tuna" from "tuna in olive oil".                             |
| `forms`         | Read "chicken" from "chicken strips".                             |
| `notFoods`      | Ignore words such as "the" or "some" on their own.                |
| `inflections`   | Match "onions" to "onion".                                        |

Norish splits a line only when it knows each food. A known name such as
"mac and cheese" stays together.

## Job queues

Open **Job queues** in admin settings to check an import or AI job. Select a job
for details.

![Job details showing the models used](/img/screenshots/admin-job-details.png)

### Cancelling a job

![A cancelled job in the job monitor](/img/screenshots/admin-job-cancelled.png)

Open a running job and select **Stop**. AI requests stop at once. Other jobs
finish their current step. Select **Retry** to run a cancelled job again.

## Manage users

Open **Users** in admin settings to manage accounts.

![The Users card in admin settings](/img/screenshots/admin-users.png)

### Roles

The first account owns the server. Use the shield button to grant or revoke
admin access. You can change roles for other accounts except the owner.

### Delete a user

Select the bin button and confirm. To delete your own account, use account
settings. The owner is protected in this list.

Deletion removes the user's groceries, meal plan, cookbook memberships and
preferences. Another member takes over their household if one remains. The
user's recipes become visible to everyone on the server.

:::warning
Account deletion is permanent.
:::
