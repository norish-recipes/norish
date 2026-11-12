---
sidebar_position: 10
title: Recipe Archive
description: Export your recipes as one file and import them into any Norish server, or import from Mela, Paprika, Mealie, Tandoor and Recipe Keeper.
---

# Recipe Archive

A **Recipe Archive** is one `.norishrecipes` file with every recipe you can
see, including photos and videos. It holds recipes only, so it is **not** a
backup.

## Exporting

Under **Settings => User**, press **Export** on the **Export recipe archive**
card. The archive holds every recipe you can see, not only your own.

![The Export recipe archive card in user settings](/img/screenshots/recipe-archive-user-export.png)

Administrators have the same button under **Settings => Admin => General**,
which exports every recipe on the server in the same format.

![The instance-wide export in admin settings](/img/screenshots/recipe-archive-admin-export.png)

## Importing an archive

Drop a file on the **Import recipe archive** card. It reads Norish archives and
exports from Mela, Paprika, Mealie, Tandoor and Recipe Keeper. For Recipe Keeper,
that is the `RecipeKeeper_….zip` file.

- **The recipes become yours.** The original author's name stays on the recipe
  as attribution.
- **A matching recipe is overwritten, not duplicated.** Norish matches on the
  URL, or on the name when one of the two has no URL, within your household.
  Importing your own archive again updates your recipes. Two recipes with the
  same name in one archive are both kept.
- **Cookbooks come along by name.** Each recipe goes into your cookbook of that
  name, which is created if you don't have one. Cookbook covers and empty
  cookbooks are not imported.

:::note
Because matching uses the name, an archive from someone else can overwrite your
recipe of the same name. Only import archives you trust.
:::

## What is not in the file

- No account data: no emails, avatars, preferences, households or sign-in
  details. Attribution is a display name only.
- Only your own rating and favourite.
- No share links, planned meals, groceries, stores, allergies or settings.
