---
sidebar_position: 7
title: Admin settings
description: What the server owner and admins can change from the app.
---

# Admin settings

Open **Settings**, then **Admin**. A badge marks settings that require a restart.

## Permissions

Use **Recipes** to choose whether Everyone or only the Household can view, edit or delete recipes and cookbooks. Edit and delete cannot be wider than view. Everyone means every signed-in account on the server; Household means the owner's household. Server admins follow the same policy. See [Households](/households).

Household lists and ingredients remain within their household. Share-link moderation, the job monitor and admin-started bulk AI enrichment reach across households.

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

Deletion erases the account's recipes, cookbooks and preferences. Household content stays if other members remain. Another member takes over as household admin if needed. A household with no members is deleted. A planned meal whose recipe is erased becomes a note, and grocery items keep their text.

:::warning
Account deletion is permanent.
:::
