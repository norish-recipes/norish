---
sidebar_position: 2
title: Aisles
description: Store categories.
---

# Aisles

Aisles are categories within a store.

## Giving a Store its aisles

Open **Manage Stores**, edit a store, and under the colour you find the
**Aisles**. Type a name and press Enter or the plus to add one, drag the handle to reorder,
and press the **X** to remove one.

![The store editor, with the Store's aisles under the colour picker](/img/screenshots/groceries-aisles-editor.png)

## Adding groceries to an aisle

There are two ways to add groceries to an aisle.

**Drag the row** into an aisle. Dragging it back to the top of the Store
uncategorises it. Dragging a row into another Store's aisle moves it to that Store
and aisle. Dragging it into another Store's top area moves it there and
leaves that Store's own memory to place it.

**Or using the edit panel** Directly under the Store selector, a Store
with aisles shows an **Aisle** field once the grocery has a name.

![The grocery panel's Aisle field under the Store selector](/img/screenshots/groceries-aisle-field.png)

## Memory

When you add a grocery to an aisle, the Store remembers that grocery **by name**.
So if you put “milk” in Dairy at a Store, the next time you add “milk” at that Store it will appear in Dairy.

An ingredient that has a parent, such as “red onion” under “onion”, uses
its parent's aisle until it is assigned itself.

That same rule applies everywhere:

- **Rename a grocery:** it will appear in the aisle the Store remembers for its new name.
- **Move a grocery to another Store:** the new Store uses its own aisle memory. No carry-over between stores.
- **Rename an aisle:** everything assigned to it stays there.
- **Remove an aisle:** the groceries that belonged to it become unassigned.
- **Delete a Store:** its aisles and all of its memory are deleted with it.

Because the Store remembers aisles by grocery name, two groceries with exactly the same name at the same Store can’t belong to different aisles.
The grouped list works the same way. Groups are per aisle, per Store. Dragging a group into another aisle assigns every grocery name in that group to that aisle.
