---
sidebar_position: 8
title: Users
description: List everyone with an account on your server, hand out admin access, and remove accounts.
---

# Users

**Settings → Admin → Users** lists everyone with an account on this server.
Only the server owner and server admins can see it.

![The Users card in admin settings](/img/screenshots/admin-users.png)

Each row shows the person's picture, name and email address, the roles they
hold, the household they belong to, and the day they joined. Household and
Joined are hidden on a phone, where there is only room for the columns you
scan by.

## Roles

Two roles appear as chips next to a name:

- **Owner** — the first account created on the server. There is exactly one,
  it always has admin access, and it cannot be demoted or deleted.
- **Admin** — can reach everything under Settings → Admin, including this
  page.

Everyone else has no chip: they are ordinary members of the server.

## Granting and revoking admin access

The shield button on a row grants admin access; on someone who already has it,
the same button revokes it. It takes effect immediately, with no confirmation
step — the change is reversible with the same click.

Two things are refused, by the server rather than by a greyed-out button:

- You cannot remove your **own** admin access. Ask another admin to do it, so a
  server can never be left without one by accident.
- You cannot change the **owner's** admin access at all.

Someone whose access you revoke keeps whatever admin page they already had open
until they navigate; the next request they make from it is refused.

## Deleting a user

The bin button asks for confirmation and then removes the account for good.
The owner cannot be deleted, and you cannot delete yourself from here — closing
your own account lives in **Settings → Account**.

Deleting a user takes their groceries, meal plan, cookbook memberships and
saved preferences with them. Two things need explaining:

- **Their household survives.** If the person you delete administers a
  household that other people are still in, the household is handed to one of
  the remaining members before the account goes. Which member inherits it is
  arbitrary; they can hand it on again from **Settings → Household**. A
  household with nobody left in it is removed along with the last member.
- **Their recipes stay on the server.** A recipe outlives the account that
  added it and becomes unowned. An unowned recipe is visible to everyone on the
  server, whatever the [recipe permission policy](./admin-settings.md) is set
  to. If that is not what you want, move the recipes to another account before
  deleting this one.

:::warning
Deleting an account cannot be undone. Take a database backup first if you are
clearing out a server you still care about.
:::
