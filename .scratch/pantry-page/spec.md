# Pantry page

Status: ready-for-agent

Settled in a `/grill-with-docs` session on 2026-10-05. The vocabulary is CONTEXT.md's **Pantry** and **Pantry Ingredient** (rewritten that day: a food the household _keeps_, and when a kept food is _on the list_), with **Ingredient**, **Ingredient Alias**, **Parent Ingredient** and **Grocery**. ADR-0036 and ADR-0037 hold the decisions this builds on; nothing here is expensive to reverse, so it adds no ADR. Target Version: 0.25.0-beta. Tickets are in `issues/`.

## Problem Statement

The Pantry was built before the ingredient catalogue, and it shows. It is a panel behind the cog menu of the groceries page: a bare list of names, each with an ✕, filled by typing one name at a time without seeing which food a name becomes. Typing can quietly mint a flagged duplicate of a food the catalogue already knows.

Running out of something is a chore that breaks the Pantry. The member removes the food, types it onto the grocery list, buys it, and then has to remember to type it back into the Pantry. Forget that last step and every recipe that uses it puts it on the list again, which is what the Pantry exists to stop.

A food in the Pantry also leads nowhere. The catalogue now knows each food's spellings, its parent and its nutrition, and the Ingredient panel shows all of it, but nothing in the Pantry opens that panel, and the panel cannot say whether the household keeps the food. Filling an empty Pantry means remembering every staple the household keeps, from nothing.

## Solution

The Pantry becomes the foods a household **keeps** at home, on a page of its own beside the grocery list, reached by a _List · Pantry_ switch at the top of Groceries.

Running out is one press: _Put on the list_ adds a grocery for the food and the food stays in the Pantry. While that grocery is still to buy, the food shows **On the list**, so a housemate sees it is handled; ticking the grocery off in the shop is the restock, and the button comes back. Taking a food out of the Pantry now means the household no longer keeps it, so it sits one step deeper, in the food's Ingredient panel.

One field at the top narrows the kept foods and, below them, finds foods in the catalogue to add, so the member picks the exact food. Pressing a kept food opens its Ingredient panel, which gains an _In your pantry_ switch and the same _Put on the list_ control, wherever it is opened. An empty Pantry offers **From your recipes**: the foods the household's own recipes use most, each with its count and one tap to add. Adding a recipe to the groceries gains a _We keep this_ action on each line to buy, so the Pantry learns a staple at the moment someone notices it.

The Pantry is still consulted in one place only: when a recipe is added to the groceries.

## User Stories

### The page

1. As a household member, I want the Pantry on a page of its own beside the grocery list, so that I see everything we keep at a glance instead of in a cramped panel.
2. As a household member, I want one switch at the top of Groceries that moves between the list and the Pantry, so that the two feel like one place.
3. As a household member, I want the Pantry to have an address of its own, so that I can bookmark it and land on it directly.
4. As a household member on a phone, I want the dock's Groceries icon to stay lit on the Pantry, so that I know where I am.
5. As a household member, I want the list-only controls (view mode, grouping, Manage stores, Add item) out of the way on the Pantry, so that the page shows only what applies to it.
6. As a household member, I want the foods we keep in alphabetical order by the name I read them in, so that I find one where I expect it.
7. As a household member, I want a loading state while the Pantry loads, so that I never think my pantry was emptied.
8. As a household member, I want to be told when the Pantry cannot be read, so that I never mistake an error for an empty pantry.
9. As a household member, I want a housemate's change to the Pantry on my screen at once, so that we keep one pantry.
10. As a household member offline, I want the Pantry to open from a cold start and show what we keep, so that it works wherever the grocery list works.

### Running out

11. As a household member, I want running out of a food to be one press that puts it on the groceries, so that I never remove a food and type it twice.
12. As a household member, I want a food I ran out of to stay in the Pantry, so that I never have to remember to add it back after shopping.
13. As a household member, I want a kept food whose grocery is still to buy shown as on the list, so that my housemates and I see it is handled and nobody adds it twice.
14. As a shopper, I want ticking the grocery off to be the restock, so that the Pantry needs nothing from me after the shop.
15. As a household member, I want the on-the-list mark however the grocery got there (typed, added from a recipe, or put there from the Pantry), so that the mark tells the truth about the list.
16. As a household member, I want only a grocery of the same food to put a kept food on the list, so that red onions bought for one recipe never tell me my everyday onions are handled.
17. As a household member, I want the grocery a press creates to land under the Store we usually buy that food at, so that I never have to file it.
18. As a household member, I want that grocery named the way I read the food and without an amount, so that it reads like a line I would have typed.
19. As a household member, I want an Undo right after putting a food on the list, so that a mis-tap costs nothing.
20. As a household member offline, I want putting a food on the list to queue like any grocery, so that it reaches the list when I am back.
21. As a household member, I want stopping keeping a food one step deeper than running out of it, so that pressing what used to be ✕ when a bottle runs out never drops a staple for good.

### Adding foods

22. As a household member, I want one field at the top that both narrows the foods we keep and finds foods to add, so that "is olive oil kept?" and "add it" are one motion.
23. As a household member, I want the field to find a kept food by any of its names in any language, so that typing "olijfolie" finds olive oil.
24. As a household member, I want matching catalogue foods listed below the kept ones as I type, so that I see exactly which food I am adding before I add it.
25. As a household member, I want picking a catalogue food to add that exact food, so that the Pantry never mints a flagged duplicate of a food the catalogue already knows.
26. As a household member, I want Enter on text that matches nothing to add it the way the Pantry adds a name today, so that a food the catalogue lacks can still be kept.
27. As a household member, I want a food we already keep never offered as one to add, so that I cannot add it twice.
28. As a household member, I want the field cleared and still focused after an add, so that a cupboard is typed in one sitting.
29. As a household member offline, I want the field to narrow the kept foods and add what I type, so that the Pantry works in a basement shop and catches up later.

### From your recipes

30. As a household member with an empty pantry, I want the foods our recipes use most offered with one tap to add, so that I fill the Pantry in one sitting without having to remember everything we keep.
31. As a household member, I want each suggestion to say how many of our recipes use it, so that I can see why it is offered.
32. As a household member, I want only recipes owned by our household counted, so that another household's cooking never shapes our suggestions.
33. As a household member, I want foods the Pantry already covers left out of the suggestions, so that the list only offers what is missing.
34. As a household member, I want a suggestion gone the moment I add it, so that I can work down the list.
35. As a household member, I want a handful of suggestions shown and the rest behind Show more, so that the page stays short.
36. As a household member whose pantry is filled, I want the suggestions folded away when I come back, so that the fresh foods we never keep do not crowd the page.
37. As a household member, I want the suggestions to stay as I left them while I am on the page, so that they never fold away while I am still adding.
38. As a household member offline, I want the suggestions simply absent, so that the rest of the page still works.

### The Ingredient panel

39. As a household member, I want pressing a kept food to open its Ingredient panel, so that I can see its spellings, its parent and its nutrition.
40. As a household member, I want the Ingredient panel to say whether we keep the food wherever I open it, so that Settings → Ingredients and a recipe's nutrition card tell me too.
41. As a household member, I want to switch a food into or out of the Pantry from its Ingredient panel, so that I can keep a food I am looking at and stop keeping one we gave up.
42. As a household member, I want that switch to land with the panel's Save, like every other field there, so that the panel behaves one way. (Changed 2026-10-05 after review: it took effect at once.)
43. As a household member, I want the Ingredient panel to show when a kept food is on the list, so that the panel and the page always agree. (Changed 2026-10-05 after review: the panel no longer puts a food on the list; that is the page's, to keep the panel calm.)
44. As a household member who may not edit an Ingredient, I want the Pantry switch to work for me anyway, so that keeping a food is a household matter rather than a catalogue permission.
45. As a household member, I want a food that is only covered by a kept kind of it shown as not kept, so that the switch says exactly what the Pantry holds.

### Adding a recipe to the groceries

46. As a cook adding a recipe, I want a "We keep this" action on each line to buy, so that I can teach the Pantry a staple at the moment I notice it.
47. As a cook, I want that line to move under "In your pantry", unticked, at once, so that it stays off the list this time too.
48. As a cook, I want "We keep this" to keep exactly the line's food, so that a recipe's "extra virgin olive oil" is kept as itself.
49. As a cook who edited a line's name in the panel, I want "We keep this" to keep the food I typed, so that the edit is what the Pantry learns.
50. As a cook, I want a kept line whose food is already on the list to show that, so that I do not tick it and buy it twice.
51. As a cook, I want everything else about adding a recipe unchanged, so that the panel works as it did.

### Language, docs and release

52. As a Dutch-speaking household member, I want the page, its field, its suggestions and its switch in my language, with foods named in my language, so that the Pantry speaks Dutch.
53. As a self-hoster, I want the Pantry page documented with screenshots, so that I can show my household how it works.
54. As an administrator upgrading to 0.25.0-beta, I want the Pantry page in the release notes, so that I know where the panel went.

## Implementation Decisions

**Vocabulary and decisions on record.** CONTEXT.md's **Pantry** now reads as the foods a household keeps; it defines _on the list_ (a Grocery of that same food still to buy, never a kind of it, unlike a recipe line), says that taking a food out means the household no longer keeps it, and lists _Out of stock_ under _Avoid_. **Pantry Ingredient** says "keeps". ADR-0036 gains an amendment: the page replaces the panel; the _on the list_ relation deliberately differs from the coverage rule; the Pantry is still consulted only when a recipe is added. No new ADR.

**No schema change.** No migration, no new table or column, no new realtime event. A Pantry Ingredient stays `(member, Ingredient, alias)`; _on the list_ is derived from the household's groceries at render time, as the add-to-groceries split is.

**The page.**

- A second view of Groceries with its own address under the groceries route. The Groceries header, kept mounted by a shared layout, carries a two-way _List · Pantry_ switch (the app's segmented Tabs toggle; changed 2026-10-05 after review from plain links) on both views, and its title reads _Pantry_ on the Pantry; it replaces the Pantry item in the cog menu, and the Pantry panel is removed.
- The Pantry view hides the cog menu, the desktop _Add item_ button and the floating add button. The dock's Groceries entry is active on both views.
- The page renders under the same providers as the list, because it reads the household's groceries and creates them.
- Kept foods are sorted by the reader's display name (the existing sort). A row is the display name, a button that opens the food's Ingredient panel, and at its end either an icon button _Put on the list_ (with that accessible name) or an _On the list_ mark. A row added offline that has no Ingredient yet shows its name without opening a panel until it syncs.
- States: a loading skeleton; an unavailable notice when the Pantry cannot be read; and an empty Pantry, which opens _From your recipes_. This fixes the panel's habit of showing "empty" while loading.
- Offline: the offline shell boots the Pantry surface for its address as it does the grocery list. The Pantry and the groceries are already in the Warm Set.
- Until the Ingredient panel's switch lands (ticket 04), the row keeps today's ✕, so a food can always be taken out.

**The one field.**

- Typing narrows the kept foods by any of their names: the Ingredient's name and every per-language name, read with the shared spelling rules, as the duplicate check does today.
- From two characters, catalogue foods matching the text are listed below the kept matches. They come from the catalogue search the Ingredients page already uses, with the reader's locale, and each is shown by its display name. A food the household already keeps is not offered.
- Picking a catalogue food adds that Ingredient. Enter with nothing picked adds the text through the resolver, as today, and the duplicate refusal stays.
- Offline the catalogue matches are absent; narrowing and adding text work, and text added offline is resolved on sync.

**`pantry.add` takes a picked food.** Besides `{ id, name }`, which is resolved as today, it accepts `{ id, ingredientId }`: the food as picked, with no resolver call. The row points at the Ingredient's own spelling. The one-per-household rule and its lock are unchanged, so a food the household already keeps answers with the existing item's id and emits nothing. The shared mutation's optimistic row for a picked food carries its Ingredient and names, so coverage and _on the list_ work before the server answers. The page's catalogue pick, the Ingredient panel's switch, _We keep this_ and the suggestions all add through this form.

**_On the list_ is one shared rule.** It is a pure function beside the pantry coverage helper in the shared pantry module. Given the household's groceries and a Pantry Ingredient, it answers with the unticked grocery of the same Ingredient, or, for a grocery with no Ingredient yet, one whose name is the same food by the food key, the same fallback coverage uses. A kind of the food never counts, and neither does a ticked grocery. The page's rows, the Ingredient panel and the add-to-groceries panel all ask it.

**_Put on the list_** (labelled _Add to groceries_ since review) creates one grocery through the existing grocery create: the food's display name for the reader, no amount and no Store, so the server files it under the household's store preference for that food, else Unsorted. It is optimistic and goes through the Outbox offline like any grocery. A toast offers Undo, which deletes that grocery.

**From your recipes.**

- A new query, `pantry.suggestions`, ranks the foods named by the lines of recipes owned by the household's members by how many of those recipes name each one; a recipe counts once per food. Lines that name no food, such as headings and links to other recipes, never count.
- It answers with each food's Ingredient, name, per-language names and count, up to a few dozen. Foods the household's Pantry covers (the same Ingredient, or a kept kind of it) are left out on the server. The client applies the coverage helper again, so an add removes its suggestion at once.
- The section sits below the kept foods. It shows a handful, with the rest behind _Show more_. It opens on load when the Pantry is empty and is folded on load otherwise, keeps whatever state the reader leaves it in during the visit, and stores nothing.
- Each suggestion is its display name, "in N recipes" and an add button. It is not a link.
- It is best-effort, outside the Warm Set: absent when offline or unavailable, and refetched when the Pantry or the catalogue changes.

**The Ingredient panel.**

- It moves out of the Settings page's folder into the shared components, since it now opens from the Pantry page, Settings → Ingredients, the recipe's nutrition card and the suggestions panel. Its page-only hooks stay optional, as they already are for the nutrition card.
- A _Pantry_ section sits under the name: an _In your pantry_ switch and, for a kept food on the list, the _On the list_ mark. The switch joins the draft; Save adds the Ingredient or removes the household's Pantry Ingredient for it, and needs no edit permission. (Changed 2026-10-05 after review.)
- The row is open to any household member, whatever the ingredient edit policy says, as removing a Pantry Ingredient is today. The switch reflects the food itself only; a kept kind of it does not turn it on.
- The pantry row's ✕ goes once the panel can take a food out.

**The add-to-groceries panel.**

- Each line to buy gets a _We keep this_ icon action with that accessible name. It keeps the line's food, or the edited text's food when the member edited the name in the panel (resolved as a typed name is). The line moves under _In your pantry_ at once, unticked.
- It only works in one direction: a line under _In your pantry_ gets no way out of the Pantry.
- A kept line whose food is on the list shows the _On the list_ mark. Ticks, select-alls and the create payload are unchanged.

**Copy.**

- New strings in all fourteen locales: the switch, the field's placeholder, _Put on the list_, _On the list_, _In your pantry_, _From your recipes_, "in N recipes" (an ICU plural; mind the select `{}` key trap), _Show more_, _We keep this_, the toasts and the states.
- The panel's strings that no longer appear anywhere are removed.

**Docs and release notes.**

- The Pantry docs page is rewritten around the page, with screenshots of: the page with a food on the list, _From your recipes_, the Ingredient panel's Pantry row, and _We keep this_.
- The Ingredients page doc mentions the Pantry row.
- The 0.25.0-beta release notes gain a section.
- Screenshots are taken with a capture spec kept in this folder, following the docs-screenshots pattern.

## Testing Decisions

A good test drives the Pantry the way a member does and asserts what they would see, or what the database then holds; it never asserts on hooks, query keys or component internals. Every seam below already exists; this adds none.

1. **Browser E2E, the main seam.** The pantry spec in the `ai` Playwright project is rewritten around the page as one serial walk through the real stack. It seeds recipes straight into the database and resets its scenario first, as it does today. It covers:
   - switching from the list to the Pantry, and that an empty Pantry opens _From your recipes_ with the seeded foods and their counts;
   - adding a suggestion and seeing it leave the suggestions;
   - narrowing by name, picking a catalogue food, and adding unmatched text with Enter;
   - _Put on the list_ putting a grocery under its Store with _On the list_ showing, and ticking it on the list bringing the button back;
   - a row opening the Ingredient panel, where turning _In your pantry_ off takes the food out;
   - adding a recipe: _We keep this_ moving a line under _In your pantry_, and a kept line on the list showing the mark.

   The catalogue spec's Dutch "ui" scenario moves from the panel to the page. One test in the `offline` project shows a cold offline start on the Pantry's address with the kept foods visible, and _Put on the list_ queueing with the mark showing. The prior art is the pantry spec and its support module, and the offline spec.
2. **The shared pantry module's unit tests.** The _on the list_ relation: the same food counts, a kind of it never does, a ticked grocery never does, and a grocery with no Ingredient yet matches by its food key. It is pinned here because it deliberately differs from coverage. The prior art is the coverage helper's tests and the shared spelling cases.
3. **The pantry repository's tests, against real Postgres.** The suggestions query: only recipes owned by the household's members count, a recipe counts once per food, lines that name no food never count, and covered foods are left out. This is where "another household's recipes do not count" is provable; the browser stack has one household. Like every repository test, it runs by hand, because `packages/db` has no `test` script for the gates.
4. **The pantry router's caller tests, with mocked repositories.** Adding a picked food skips the resolver, and a food the household already keeps answers with the existing id and emits nothing. Suggestions are asked for with the household's user ids.

Housekeeping, not new seams: the panel's component test becomes the page's, for what the browser cannot reach cheaply (loading, unavailable, empty). The add-to-groceries component tests change only where the line's markup changes.

Known E2E traps: the stack runs the prebuilt server bundle, so rebuild before a direct spec run. The pantry, grocery and catalogue specs share one database, so each resets its own scenario. The list opens grouped, and adds of the same unit merge.

## Out of Scope

- Amounts, units, best-before dates or any stored _out_ state; the Pantry is not an inventory.
- Showing the Pantry anywhere else: marks on the recipe page, a Library filter, a warning in the manual Add Item panel, or anything on the grocery list itself.
- A shipped starter list of staples; dismissing a suggestion; grouping the page by the ingredient tree, by places at home or by a Store's Aisles.
- Removing a food from a row, by ✕ or swipe, once the panel's switch exists.
- Taking a food out of the Pantry from the add-to-groceries panel, and adding to the Pantry from a grocery row.
- Any change to coverage (ADR-0037's rule) or to who owns a Pantry Ingredient when a member leaves the household.
- A shareable address for an open Ingredient panel.
- The mobile app, which is parked pending a rewrite.

## Further Notes

- Grouping by the ingredient tree was rejected on data, not taste. The tree is Open Food Facts' food-science taxonomy: on the production copy black pepper and cumin sit under "seed", paprika under "condiment > spice", pasta under "dough" and honey under "added sugar".
- There is no usage data to design from: the production copy predates 0.24 and holds no Pantry Ingredients.
- CI: on 2026-10-05 the RC build's Quality job hit its 30-minute limit at E2E test 130 of 147 with no failures. The suite had simply outgrown the limit. These tickets add browser tests, so the limit has to be raised before their gates can pass in CI.
- Target Version 0.25.0-beta was the recommendation and was not contested. Nothing here touches the upgrade path the production copy is testing.
