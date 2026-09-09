---
sidebar_position: 1
title: Prices
description: Point a Store at a real shop and Norish shows what a grocery costs there, reading the shop's own pages without an AI provider.
---

# Prices

A **Store** in Norish is a heading your groceries are grouped under: a name, a
colour, an order you chose. A Store can additionally point at a real shop's
website, and once it does, Norish can show what the things on your list cost
there.

Everything on this page is optional. A Store with no website is an ordinary
Store and always was.

## Pointing a Store at a shop

Open **Manage Stores**, add or edit a store, and paste a link into **Shop
link**. You never have to write a template: paste either

- the shop's homepage — `https://www.example.nl` — and Norish looks for its
  search page, or
- a search you just ran there — `https://www.example.nl/zoeken?query=kaas` —
  and Norish takes the term out of it.

Underneath the field you see what Norish made of the paste: the **Search
Address**, with `{query}` marking where a search term goes, and an example of
it resolved. The field stays yours to correct — if the guess picked the wrong
part of the address, move `{query}` yourself.

![The store form, showing the Search Address derived from a pasted link](/img/screenshots/groceries-store-link.png)

When you save, Norish tries the address once and tells you what it found:
how many priced products came back, that the shop answered but stated no
prices, or that it did not answer at all. It saves either way — the message is
there so a wrong link is caught while you are still holding it.

:::note Which term is used to test
If your paste contained a real search, Norish tests the address with **your**
word, because that word is known to have results at that shop. A fixed English
probe would report "no products found" against a Polish shop that works
perfectly.
:::

## What a grocery costs

A priced grocery shows its total first, with the amount to buy and the
price of each product beside it: **€10.50 (2 × €5.25)**. Underneath is
which of the shop's products that price is for. A product on Sale shows the
regular total struck through before the new one. Tap the grocery or its
price to adjust it.

![A shopping list with Line Costs on its rows](/img/screenshots/groceries-prices.png)

The Shelf Price is what one pack costs — the number on the shelf edge, not a
price per kilo. Norish keeps only the price it last read, and refreshes it
when it is more than twelve hours old and you are looking at the list.

### How many packs

Norish counts packs the way a till does, from your grocery's own amount and
what the shop says one pack holds: "700 g flour" against a 500 g pack is two
packs, "12 eggs" against a box of ten is two boxes, and what the shop sells
loose is priced by weight, so 700 g of bananas priced per kilo costs seven
tenths of it and the row reads `€1.39 · 700 g`. A grocery with no amount
costs one pack. Where Norish cannot make the two meet — a pinch of
something sold by the jar, say — the row still shows a price: it counts one
pack, with a quiet note under the product name saying so.

### Adjusting the amount to buy

The grocery panel's **Amount to buy** starts with the calculated amount.
Use the minus/plus buttons or type a number, then press **Save** or **Add**.
For example, keep your original **800 g** requirement but choose **3** to
buy. **Use calculated amount** removes your override and restores automatic
calculation. A product sold by weight accepts a decimal amount in the unit
shown beside the label.

![The grocery panel with a quick amount control](/img/screenshots/groceries-purchase-amount.png)

Your choice stays with this grocery after a reload and is shared with your
household. It does not change other groceries linked to the same product or
future occurrences of a recurring grocery. In a group, explicit purchases
are added to the purchases calculated for its other sources. Open the group
to adjust each source. Pack sizes are used automatically behind the scenes.

### The Store's heading

The Store's heading adds the Line Costs up: every row still to buy under it,
in the shop's own currency. A row the Store cannot price is left out of the
sum rather than guessed at, and a row you tick off leaves it. Each view
prices what it shows: in the plain list every row is its own purchase; when
the list groups similar ingredients, a group is one row and one purchase,
priced from its recipes' amounts added together — 300 g and 0.4 kg of flour
are priced as 700 g, two packs, even though the group still shows them apart.

### While Norish is asking

Adding a grocery never waits on a shop:

- a name the Store already knows is priced in the same breath, with no
  outbound request at all;
- a name it does not know goes to a queue, and the price appears on your list
  the moment it lands — on your housemates' screens too.

While the shop is being asked, the row shows a small loader where the price
will go, so a blank reads as waiting and not as failure. The loader is a fact
about the Store rather than about your screen: your housemates see it on the
same row, and it goes when the answer lands. A shop that does not answer at
all leaves nothing behind, and the name is asked again on a later visit.

Norish links a grocery to a product by itself only where you would not
hesitate: your grocery's name is a product's name to the letter, or every word
of it appears in exactly one product's name. Anything less certain is left to
you. A name that matches to the letter is taken however many listings carry
it, the first in the shop's own order; a product the shop lists twice under
two product numbers counts once in the dropdown, since there is nothing to
choose between.

## Choosing the product yourself

Which of the shop's products a grocery is, is a field of the grocery's own
panel — beside its store, where it belongs. Open a grocery and the **Product**
field reads whatever it is linked to now; open the dropdown and Norish asks the
shop about the grocery's own name, or about whatever you type instead.

The dropdown answers in two groups, because the two are not the same kind of
fact. **Already known** is what this Store has stored from earlier — there
instantly, no shop involved. **From the shop** is what the shop is answering
right now, and while a slow supermarket is still being read that group says
so, so you can see it working rather than guess.

![The product field in a grocery's panel, offering priced results from the shop](/img/screenshots/groceries-picker.png)

Picking one fills in **Amount to buy** and **Price**, and **Open at
Dirk** beside the field takes you to the product's own page at the shop, in
a new tab, for a product Norish read there. The **Product details** row
under them sums up the currency and the pack; tap it and those
open in a panel of their own, the way the recurrence editor does, for the
rare correction. Nothing is written until you press **Save** or **Add** —
what you do in the dropdown changes nothing your household sees until then.
Norish asks the shop only once you use the field, so opening a grocery to
rename it sends nobody to a supermarket, and a Store with no shop link shows
the field greyed out rather than pretending it can search.

Those fields are yours to correct. Type over the price and it becomes
**your** price for that name at that Store: Norish never writes over a price it
read from a shop's own page, so a correction sits beside what the shop said
rather than through it. A price that is not a number, or a currency that is
not three letters, is said so under the field, and **Save** waits until it
is fixed rather than quietly dropping it.

### A shop Norish cannot read

Some shops answer with nothing Norish can read, and some cannot be searched at
all — a shop link Norish could not make a search page out of. A shop that does
not answer at all — down, or turning the visit away — is reported as exactly
that, not as a shop with nothing on its shelf. In every case the field offers to
take a price by hand: a name, prefilled with the
grocery's, and the price and currency you saw. There is nothing to press — a
price you have typed is your choice, and Save writes it like any other. That
makes a Store Product like any other, except that nothing Norish reads will
ever overwrite it: a price you typed is the last word. Type over it later and
it is the same product, corrected, not a second one beside it.

## Sales

A **Sale** is what the shop presents as one: a price with the regular price
it replaces beside it. On the row it reads the way a shelf tag does: the
regular Line Cost struck through, and the new one right beside it,
~~€6.58~~ **€4.38**, no louder than any other price. Hover the price for the
shop's own words for the deal — "Weekend actie", "Bonus". The picker shows
the same on each result, so you can see a deal before you choose it.

A deal the shop keeps as a label over its regular price — Albert Heijn's
"2 voor €5.50" — is no Sale: the price stands as it is, the words are its
hover text, and they are never worked into the number:
Norish prices what the shop presents as the price, and tells you the rest in
the shop's words so you can act on it at the shelf. A Sale lasts until the
shop presents another price; a refresh that reads the same price keeps it,
and one that reads any other price ends it. A product you correct by hand
keeps the Sale, the deal's words and the pack of the product it corrects;
whether it is still a Sale is decided by the price you typed against the
regular one, so typing the regular price ends it.

## What this does not do yet

Deliberately, for now:

- no deal arithmetic: "2 voor €5.50" is shown, never computed;
- no card, membership or login-gated prices — Norish cannot tell a card
  price from a markdown by markup, so a shop that presents its card price as
  the price is priced at it;
- no comparable unit prices (€/kg beside a pack);
- no price history — a Shelf Price is overwritten and the one it replaces is
  gone;
- no tolerance on automatic pack rounding; you can override the amount to buy;
- prices are a web surface: they do not appear in the mobile app.

## For self-hosting operators

- **No AI provider is needed.** Shop pages are read with a fixed ladder over
  the structured data a shop already publishes for search engines, plus a pass
  over the product cards for the prices. There is no model in this path and
  nothing to pay for.
- **No new environment variables.** Nothing to change when you upgrade.
- **Norish will not hammer a shop on your behalf.** Store visits run on one
  always-on queue, one visit at a time, paced. There is no scheduled sweep:
  Norish never visits a supermarket for a list nobody is shopping.
- **Some shops need a browser.** A shop that turns a plain fetch away, or
  answers it with a bot challenge, is fetched through Obscura — the same
  headless browser Norish already uses for recipe imports. Without Obscura
  running, shops that answer a plain fetch still work, and the rest can be
  covered with hand-typed prices.
