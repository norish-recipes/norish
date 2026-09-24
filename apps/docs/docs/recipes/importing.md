---
sidebar_position: 1
title: Importing recipes
description: How a recipe gets into Norish from elsewhere, from a link, a link you copied, pasted text or a photo, and what happens between pressing Import and the recipe appearing.
---

# Importing recipes

Most of a library did not start in Norish. **Add Recipe** on the dashboard
offers every way in, and each of them ends the same way: a card appears in the
library at once and fills in as the import runs, and the result opens in the
same form as any other recipe, where whatever the import got wrong is a quick
edit away ([Creating and editing](./creating-and-editing.md)).

## From a link

**Add Recipe => URL** asks for the address of a recipe page. A link already on
your clipboard is filled in for you, so the usual round trip is: copy the
address, open the dialog, press **Import**. Pasting a link straight into the
library's search box imports it too, without a dialog.

Norish reads the page structurally first, through the
[recipe parser](../configuration/parser.md), which knows several hundred sites
by name and reads any page that publishes its recipe as structured data. When
that finds nothing and an AI provider is configured, the page goes to the AI
provider instead; **AI Import** sends it there straight away, for a site you
know the parser struggles with. A link to a video post, on YouTube, Instagram,
TikTok and the like, is transcribed and needs an AI provider.

## From a copied link

Copy a recipe's address anywhere, come back to Norish, and whichever page you
are on asks:

![Norish asking to import a copied link](/img/screenshots/import-clipboard-prompt.png)

**Import** queues the import exactly as the URL dialog would and leaves you
where you are: the new card fills in on the dashboard, and a message offers to
open the recipe once it is in. Close the ask, or let it go, and nothing
happens. A tab asks about a link once: a link you passed on is not
raised again on the next page or visit, while a new one is, and a link into
your own Norish is never offered. Offline, the import is
[Queued](../offline.md) like any other change and runs once your server is
reachable again.

The ask relies on the browser handing the clipboard over without you pasting.
Chrome, Edge and the other Chromium browsers do, once you have allowed Norish
to read the clipboard; the browser asks the first time. Safari and Firefox only
hand it over inside a paste, so there a copied link turns up in the URL
dialog's prefilled field instead.

## From pasted text or a photo

**Add Recipe => Paste** takes a recipe as text or as JSON-LD, and **Add Recipe
=> Image** takes up to ten photos of one recipe, a cookbook page or a
screenshot. Reading a recipe out of free text or a picture is the AI provider's
work, so the Image option only appears when one is configured.
