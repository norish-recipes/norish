---

sidebar_position: 1
title: Prices
description: Point a Store at a real shop and see what the groceries on your list cost there, using the shop's own pages and no AI provider.
--------------------------------------------------------------------------------------------------------------------------------------------

# Prices

A **Store** is a heading your groceries sit under. A Store can additionally point at a real shop, so the list can show what its groceries cost there.

## Pointing a Store at a shop

Open **Manage Stores**, edit a Store, and paste the shop's homepage or one of its search pages into **Shop link**.

The link is turned into a **Search Address**, with `{query}` where the grocery name goes. You can edit that address yourself if the shop needs something different.

![The store form, showing the Search Address derived from a pasted link](/img/screenshots/groceries-store-link.png)

When you save, the shop is tried once and you are told whether priced products were found, products without prices were found, or the shop could not be reached. The Store is saved either way.

## Prices on the list

When a grocery is linked to a shop product, its row shows the total to buy and the price of each pack:
The shop's product name sits underneath. If it is on sale, the regular total is struck through beside the sale price.

![A shopping list with Line Costs on its rows](/img/screenshots/groceries-prices.png)

The Store heading adds up everything still to buy. Groceries without a price are left out of that total, and ticking a grocery removes its price from it.
When similar ingredients are grouped, the group is priced as one purchase. So 300 g and 400 g of flour become 700 g when deciding how much to buy.

## How much to buy

The amount on your grocery is compared with the amount one shop product contains.

So 700 g of flour against a 500 g pack means two packs, and 12 eggs against a box of ten means two boxes.

A grocery without an amount means one pack. If its amount cannot sensibly be compared with the shop's pack, one pack is used.

You can override this in the grocery panel under **Amount to buy**.

![The grocery panel with a quick amount control](/img/screenshots/groceries-purchase-amount.png)
