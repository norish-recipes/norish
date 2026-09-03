# 03 — The list says what the trip costs

**What to build:** Every store's section header carries its **Open Total**, the cost of its undone groceries, with an **Unpriced** count beside it. The page header carries the **Trip Total** and the Open Total side by side. Ticking a grocery off moves the Open Total and leaves the Trip Total; deleting it moves both. A grouped row costs its packs once. Unsorted never shows a total. All of it is derived on the client by one shared function from groceries, links and products, and nothing is stored.

**Blocked by:** 02 — there is nothing to add up before products and links exist.

**Status:** ready-for-agent

- [ ] One pure function in the shared package computes, per store and overall, the Trip Total, the Open Total and the Unpriced count from groceries, links, products and Pack Counts; the store header, the page header and the grouped view all use it
- [ ] A grocery costs its linked product's effective price times its Pack Count; a grouped row costs its first source's product times the group's Pack Count, once
- [ ] A grocery is Unpriced when it has no link, when its product has neither price, or when its product's currency differs from the store's other priced products; the count says how many
- [ ] Groceries in Unsorted are always Unpriced, and the Unsorted section shows no total
- [ ] Totals are formatted in the reader's locale and the store's advertised currency; the page totals show the currency of the stores they sum and never add two currencies together
- [ ] Ticking a grocery off lowers its store's Open Total and the page's Open Total and leaves the Trip Total; deleting lowers both
- [ ] Unit tests cover every rule above, including grouped rows and a mixed-currency product; a browser test watches the header figures move as items are ticked and untied
