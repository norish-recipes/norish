---
sidebar_position: 1
title: Prices
description: Connect a Store to a real shop and see what your groceries cost.
---

# Prices

A **Store** can point at a real shop's website, so you can see what your groceries cost.

## Linking a shop

Open **Manage Stores**, edit a Store, and paste the shop's homepage or one of
its search pages into **Shop link**. Norish turns it into a **Search Address**
with `{query}` where the grocery name goes. You can edit it if the shop needs
something else.

![The store form, showing the Search Address derived from a pasted link](/img/screenshots/groceries-store-link.png)

When you save, Norish tests the link. If it finds no products, the panel says
so and you need to fix the link by hand.

## Pricing {#which-product}

A grocery linked to a shop product shows the total to buy, price per pack
and product name.

![A shopping list with Line Costs on its rows](/img/screenshots/groceries-prices.png)

The Store heading adds up what is still to buy. Groceries without a price, and
done ones, are not counted. Grouped groceries are bought as one: 300 g and
400 g of flour count as 700 g.

![The product field, with the shop's answers to pick from](/img/screenshots/groceries-picker.png)

With a [Decision Model](../configuration/ai-provider.md#decision-model) set up
for _Grocery linking_, Norish asks it when the name doesn't match. It links the
model's pick when that pick is likelier than all other products together.
Otherwise you get the shop's products to choose from, most likely first.

**Unlink product** in the grocery panel removes the link and the price.

## How much to buy

Norish compares the grocery's amount with what one pack holds. 700 g of flour
and a 500 g pack is two packs, and 12 eggs and a box of ten is two boxes. A
grocery without an amount, or one that can't be compared, is one pack.

Change it under **Amount to buy** in the grocery panel.

![The grocery panel with a quick amount control](/img/screenshots/groceries-purchase-amount.png)
