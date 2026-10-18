---
sidebar_position: 8
title: Users
description: Manage users.
---

# Users

**Settings => Admin => Users** shows everyone with an account on your instance.

![The Users card in admin settings](/img/screenshots/admin-users.png)

## Roles

- **Owner**: the first account on the server. Only one person can be the owner.
- **Admin**: can open everything under **Settings => Admin**.

The shield button on a row grants or revokes admin access. You can't revoke
your own and you can't change the owner's.

## Deleting a user

The bin button deletes the account after you confirm. You can't delete the
owner or your own account here. Delete your own under **Settings => Account**.

The person's groceries, meal plan, cookbook memberships and preferences are
deleted with the account.

- If they run a household that still has other members, one of those members
  takes it over.
- Their recipes stay and become unowned. Everyone on the server can see
  unowned recipes, no matter the
  [recipe permissions](./admin-settings.md#permissions).

:::warning
Deleting an account can't be undone. Make a backup if you are unsure.
:::
