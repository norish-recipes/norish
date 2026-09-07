---
sidebar_position: 2
title: Aisles
description: Give a Store the aisles of the shop it stands for, and your list is shown in the order you walk it, with every name filed once and remembered.
---

# Aisles

A **Store** in Norish is a heading your groceries sit under. A Store can
additionally have **Aisles**: headings within it, named and ordered the way you
walk the shop, so "melk", "bananen" and "yoghurt" no longer sit wherever they
were added but under Zuivel, Groente and Zuivel, in the order you meet them.

Everything on this page is optional. A Store with no aisles is exactly the Store
it always was, and a Store with no website can have aisles too: a market stall
can have a route through it.

## Giving a Store its aisles

Open **Manage Stores**, edit a store, and under the icon picker you find its
**Aisles**. Type a name and press Enter or the plus to add one, type over a
name to rename it, drag the handle to reorder, and press the X to remove one.
A name the Store already has, in any case, is refused where you type it, so
"Zuivel" and "zuivel" cannot both exist.

![The store editor, with the Store's aisles under the icon picker](/img/screenshots/groceries-aisles-editor.png)

Nothing is written until you press **Save**: the aisles are saved with the
Store, in one go, so you can experiment freely and removing an aisle needs no
confirmation. A new Store can be created with its aisles in the same breath.
Your household shares them through the Store it already shares.

## The list by aisle

Once a Store has aisles, its block shows every one of them as a slim heading,
in the Store's order, whether or not anything is filed under it, an empty one
quieter than a filled one, so the shop's shape is always visible and there is
always a place to drag a row. The Store's heading, its total, "Mark all done"
and "Delete done" stay exactly as they are, and ticked groceries sink into the
Store's done tail as they always did.

![A Store's block shown by aisle, with unfiled rows at the top](/img/screenshots/groceries-aisles-list.png)

A grocery the Store has never been told about is **unfiled**: it sits at the
top of the block, under no heading, where it is noticed and filed. Norish never
guesses an aisle from words, and no AI is involved, so you are never shown milk
in the bread aisle because a word looked like bread.

## Filing a grocery

There are two ways to file, and both teach the Store the same thing.

**Drag the row** into an aisle. Dragging it back to the top of the Store
unfiles it. Dragging a row into another Store's aisle moves it to that Store
and files it there in one gesture; dragging it into another Store's top area
moves it there and leaves that Store's own memory to place it.

**Or open the grocery's panel.** Directly under the Store selector, a Store
with aisles shows an **Aisle** field once the grocery has a name: the Store's
aisles in order, and **No aisle**. It reads what the Store remembers for the
name, so filing reads as correcting a fact rather than filling a blank, and it
switches to the other Store's aisles when you swap the Store in the panel. It
writes nothing until you press **Save** or **Add**, so a new name can be taught
to the Store the moment it is typed.

![The grocery panel's Aisle field under the Store selector](/img/screenshots/groceries-aisle-field.png)

## What the Store remembers

Filing is a fact about a _name_ at a Store, not about a list line. Filing one
"melk" files every "melk" at that Store, on every household member's screen,
this week and every week after: next week's "melk" is already in Zuivel without
anybody touching it, because a grocery is ticked off and cleared but the
Store's memory of the name stays.

The same rule works in every direction:

- rename a grocery and it is shown wherever the Store files its **new** name;
- move a grocery to another Store and it is shown wherever **that** Store files
  it, because each shop's own memory applies and nothing is carried between
  shops;
- rename an aisle and everything filed under it stays filed;
- remove an aisle and everything under it is simply unfiled;
- delete a Store and its aisles and memory go with it.

Two lines with the identical name at one Store can therefore never sit in
different aisles. If you want frozen chicken in the freezer aisle, name it so:
"kip (diepvries)" is remembered forever as its own name. In the grouped list
this is exactly how groups work too: groups are per aisle per Store, so "kip"
filed in Vlees and "kip (diepvries)" filed in Diepvries are two groups, and
dragging a group into an aisle files every name in it.

Filing works offline like every other change to the list: it is shown at once,
queued, and caught up when you surface.

## What this does not do yet

Deliberately, for now:

- no starter set of aisles: every household types its own;
- no guessing an aisle from words, a shop's own taxonomy, or an AI;
- no aisle-level totals, mark-all-done or delete-done, and no collapsing an
  aisle;
- no copying aisles between Stores;
- aisles are a web surface: the mobile app shows the list as it did.

## For self-hosting operators

- **No AI provider is involved and nothing goes outbound.** Grouping a list is
  free and private.
- **No new environment variables.** Two tables are added by migration; see the
  release notes.
- Aisles travel with the Store, so `GET /api/v1/stores` lists each Store's
  aisles read-only. `POST /api/v1/stores` is unchanged and creates a Store with
  no aisles; filing has no REST endpoint.
