---
sidebar_position: 2
title: Aisles
description: Give a Store the aisles of the shop it stands for, and your list is shown in the order you walk it, with every name filed once and remembered.
---

# Aisles

A **Store** in Norish is a heading your groceries sit under. A Store can
additionally have **Aisles**, you could also see this as categories.

## Adding aisles to a store

Open **Manage Stores**, edit a store, and under the colour you find the
**Aisles**. Type a name and press Enter or the plus to add one, type over a
name to rename it, drag the handle to reorder, and press the **X** to remove one.

![The store editor, with the Store's aisles under the colour picker](/img/screenshots/groceries-aisles-editor.png)

## The list by aisle

Once a Store has aisles, its card shows every one of them, this is
done purposefully to make drag and drop easy.

![A Store's card shown by aisle, with unfiled rows at the top](/img/screenshots/groceries-aisles-list.png)

An unknown grocery, e.g. one that's added for the first time. Will default
to no aisle at the top of a store or the unsorted section.

## Adding groceries to an aisle

There are two ways to add groceries to an aisle.

**Drag the row** into an aisle. Dragging it back to the top of the Store
unlinks it. Dragging a row into another Store's aisle moves it to that Store
and aisles. Dragging it into another Store's top area moves it there and
leaves that Store's own memory to place it.

**Or using the edit panel** Directly under the Store selector, a Store
with aisles shows an **Aisle** field once the grocery has a name.

![The grocery panel's Aisle field under the Store selector](/img/screenshots/groceries-aisle-field.png)

## Memory

When you add a grocery to an aisle, the Store remembers that grocery **by name**.

So if you put “melk” in Zuivel at a Store, every “melk” at that Store will appear in Zuivel.

That same rule applies everywhere:

- **Rename a grocery:** it will appear in the aisle the Store remembers for its new name.
- **Move a grocery to another Store:** the new Store uses its own aisle memory. Nothing carries over between Stores.
- **Rename an aisle:** everything assigned to it stays there.
- **Remove an aisle:** the groceries that belonged to it become unassigned.
- **Delete a Store:** its aisles and all of its grocery-to-aisle memory are deleted with it.

Because the Store remembers aisles by grocery name, two groceries with exactly the same name at the same Store can’t belong to different aisles.

The grouped list works the same way. Groups are per aisle, per Store, and per unit: lines of one name measured the same way share a row and add up, while a line measured differently, or with no measure at all, keeps a row of its own. Dragging a group into another aisle assigns every grocery name in that group to that aisle.
