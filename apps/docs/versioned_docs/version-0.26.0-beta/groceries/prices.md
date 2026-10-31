---
sidebar_position: 1
title: Prices
description: Connect a Store to a real shop and see what your groceries cost.
---

# Prices

A **Store** can point at a real shop's website, so you can see what your groceries cost.

## Linking a shop

Open **Manage Stores**, edit a Store, and paste the shop's homepage or one of
its search pages into **Shop link**. It becomes a **Search Address**
with `{query}` in place of the grocery name. You can edit it if the shop needs
something else.

![The store form, showing the Search Address derived from a pasted link](/img/screenshots/groceries-store-link.png)

The link is tested when you save. If no products are found, the panel asks
you to fix the link by hand.

## Pricing {#which-product}

A grocery linked to a shop product shows the total to buy, price per pack
and product name.

![A shopping list with Line Costs on its rows](/img/screenshots/groceries-prices.png)

The Store heading totals priced groceries still to buy, excluding done items. Grouped groceries are bought as one: 300 g and
400 g of flour count as 700 g.

![The product field, with the shop's answers to pick from](/img/screenshots/groceries-picker.png)

With a [Decision Model](../configuration/ai-provider.md#decision-model) set up
for _Grocery linking_, a failed name match goes to the model. Its pick is
linked when it is likelier than all other products together.
Otherwise you get the shop's products to choose from, most likely first.

**Unlink product** in the grocery panel removes the link and the price.

## How much to buy

The amount to buy is calculated from the grocery amount and pack size:
700 g of flour needs two 500 g packs; 12 eggs need two boxes of ten. A
grocery without an amount, or one that can't be compared, is one pack.

Change it under **Amount to buy** in the grocery panel.

![The grocery panel with a quick amount control](/img/screenshots/groceries-purchase-amount.png)
