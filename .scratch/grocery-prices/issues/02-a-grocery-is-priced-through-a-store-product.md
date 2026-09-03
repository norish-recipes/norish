# 02 — A grocery is priced through a Store Product

**What to build:** The heart of ADR-0028. A **Store Product** is one specific item a store sells, and a grocery is priced only by a **Product Link** to one. In this ticket products are made by hand: from a grocery's edit panel a new **Product** field opens the **product picker**, which lists the products the store already knows and offers "make one by hand" with a name and a price. Choosing one links the grocery's name to it for the whole household, so the next grocery with that name bound for that store is priced without asking. The grocery row shows the linked product's name as a second line and its price at the trailing edge. A **Set Price** on a product wins for everything shown; clearing it is one action. A **Pack Count** stepper on the row's edit panel multiplies the line's cost. Groceries in Unsorted show no product field.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] A store product stores its store, its name, an optional page address unique within the store, an optional Store Price, a currency, an optional regular price, a read-at moment, an optional Set Price, an origin (by hand, page, lookup) and a version; deleting a store deletes its products
- [ ] A product link stores its store, the normalised grocery name, the product, whether a person chose it and a version, unique per store and name; the normalisation is the same function the Store Preference uses
- [ ] A grocery stores a Pack Count, an integer of at least one, defaulting to one
- [ ] Household procedures exist to list the household's products and links, make a by-hand product, set and clear a Set Price, delete a product, choose a link, unlink, and set a Pack Count; every one is household-guarded and version-guarded, and every write announces itself on the store or grocery realtime channel with the existing echo-suppression rule
- [ ] A by-hand product takes the currency its store's other products advertise, else the currency implied by the instance's default locale, else asks for one
- [ ] The grocery edit panel shows a Product field for a grocery in a store and none for a grocery in Unsorted; the picker lists linked and by-hand products first and offers "make one by hand"
- [ ] Choosing a product on a grouped row links every name in the group; choosing on a single row links that name
- [ ] The row shows the product's name beneath the grocery's own name and the effective price, the Set Price when there is one, formatted in the reader's locale and the product's currency
- [ ] Deleting a product unprices every grocery that pointed at it; unlinking leaves the product for others
- [ ] Router tests cover every procedure's guard and its event; database tests cover the two uniqueness rules and the cascade; a browser test makes a by-hand product, links a grocery, sees its price on the row, sets and clears a Set Price and changes the Pack Count
