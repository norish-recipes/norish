---
sidebar_position: 2
title: Shop with Bring!
description: Send recipe ingredients to Bring! instead of the built-in grocery list.
---

# Shop with Bring!

If your household already shops with [Bring!](https://www.getbring.com), an administrator can make it
the instance's shopping list. Adding a recipe's ingredients then sends them to
Bring! instead of the Norish grocery list.

## Turn it on

Open **Settings**, then **Admin**, then **General**, and under **Shopping list**
choose **Bring!**. The change applies to everyone on the instance at once,
without a reload. Choose **Norish grocery list** to switch back.

![The Shopping list setting in admin settings, set to Bring!](/img/screenshots/groceries-bring-setting.png)

Norish must be reachable from the internet over HTTPS. Bring! cannot take
items directly, so Norish puts them on a temporary web page and Bring!'s
servers fetch it. Set `AUTH_URL` to your public `https://` address.

Before it opens Bring!, Norish has Bring! read that page once. If Bring!'s
servers cannot fetch it, adding ingredients shows an error with the HTTP status
your server answered them, and nothing is sent.

Addresses under `/share/bring/` must open from the internet without a login,
VPN, IP allowlist or bot protection in front of Norish. If your reverse proxy
already lets `/share/` through for shared recipes, `/share/bring/` is covered;
if it lists paths one by one, add `/share/bring/`.
See [Server & runtime](/configuration/server-runtime#networking--origins).

## Add ingredients to Bring!

Every place that adds ingredients to the groceries now says **Add to Bring!**:
the planning panel, the recipe's actions menu and a recipe card's menu. Tick
the ingredients, edit a name or amount if you like, and press **Add to
Bring!**.

![The Add to Bring! panel with ingredients ticked](/img/screenshots/groceries-bring-panel.png)

Amounts match the servings you chose, and foods **In your pantry** stay apart
and unticked, as they do for the Norish grocery list. Bring! shows the items
as a recipe named after yours. Units are written short, in your language, as
the groceries show them: "250 g flour".

The button shows that it is working while Norish prepares the items, then
Bring! opens in a new tab. If your browser blocks that tab, a message with
**Open Bring!** appears instead; it stays until you close it.

## What Bring! receives

Bring! receives the recipe's name, its main photo, the servings and one line
per ingredient, such as "200 g flour". Norish keeps these for one hour on a
page whose address nobody can guess, and the photo at that address plus
`/image`; then both expire and are deleted on their own. The page shows
nothing else: no person, no household, no link to your recipe and no other
photos. A recipe without a photo shows the Norish logo in Bring!.

Bring! thereby also sees your instance's public address, and anyone who holds
the temporary link can read that list and see that photo until it expires
after an hour.

You can send up to 30 lists in 10 minutes.

## What happens to the Norish grocery list

Choosing Bring! hides the **Groceries** tab, and addresses under `/groceries`
take you home. Nothing is deleted. Your groceries, Stores, aisles, pantry and
recurring groceries stay where they were, the API at `/api/v1/groceries` works
as before, and recurring groceries keep adding to the hidden list. Edit your
pantry from an ingredient's panel while the tab is hidden.

Switch back under **Shopping list** and the list returns exactly as you left it.

## The mobile app

The mobile app ignores the setting in this release. It keeps showing the Norish
grocery list and its own wording, because its Groceries tab and add screens
have not been adapted yet, and a half-adapted app would show the wrong list.
Use the web app to send ingredients to Bring!. The mobile app will follow in a
later release.
