# 05: Typed groceries and pantry entries split per food

**What to build:** A Grocery, a recurring grocery and a Pantry Ingredient name exactly one food. When a person types a text that names several, it becomes one row per food, each with its own part of the text. "zout en peper" typed on the list becomes the groceries "zout" and "peper". Each gets its own aisle, price and store, and each merges with an existing grocery of that food as same-unit adds do today. The same holds when a grocery is renamed to such a text, for a recurring grocery, and for a pantry add. An "or" text ("boter of olie") typed on the list adds its first food, and in the Pantry each. A text that names nothing stays one grocery, pointing at no food (from 01).

See `CONTEXT.md` (Ingredient Alias, Grocery, Pantry Ingredient).

**Blocked by:** 04

**Status:** done

- [x] Typing "zout en peper" adds two groceries with texts "zout" and "peper", each pointing at its food. An offline add splits once it syncs.
- [x] Renaming a grocery to "zout en peper" leaves two groceries.
- [x] A recurring grocery "zout en peper" becomes two recurring groceries with the same rule.
- [x] Adding "zout en peper" to the Pantry adds two Pantry Ingredients.
- [x] "boter of olie" typed on the list adds "boter"; in the Pantry it adds both.
- [x] A name's rows are written all or none.
- [x] Both new rows announce over realtime like any created grocery, and a second tab converges.
- [x] Grocery and pantry tests cover the above against a real database. All `CONTRIBUTING.md` gates pass.

## Comments

2026-10-18, implemented:

- `typedParts` (resolver) reads, without AI and minting nothing, the parts a typed text stands for: each food a "together" text joins, the first of "alternatives". Each part is then resolved once, as any typed name is, so a typed add that merges into a line already there asks nothing.
- `groceryParts` applies it to grocery names. An edit that leaves a grocery's text alone keeps it whole, as does a recipe-line grocery under a one-food line's own text. A typed create splits before the same-unit merge, so each part merges with a grocery of that name. A rename, a recurring rename and a detach keep the row as the first part. The rest go on the list as typed adds, each finding its own Store and pack count. A recurring create or rename repeats each food on the same rule. A Pantry add puts each food in, and the router announces every item it made, answering with the first's id.
- The client's create answer may carry more groceries than it sent: the reconcile inserts each, pairing ids with what was sent only one to one. A `created` echo now replaces a held row that is no newer than the server's, so an offline add whose name split shows its parts on Replay without waiting for Recovery's refetch.
- `POST /groceries` answers with the first grocery.
- Browser: the realtime project types "realtime-zout en realtime-peper" in one browser and sees both groceries in both. It also renames a grocery, creates a recurring grocery and adds to the Pantry with joined names over tRPC, and reads back a row per food.

2026-10-19, Mike's review:

- The Pantry keeps each food "boter of olie" offers (`typedParts` with `alternatives: "each"`); the list keeps the first.
- A name's rows are one transaction: a typed add's merges and new lines, a rename or detach with its other foods (`createGroceriesData`'s `edit`), a recurring create or rename (`createRecurringGroceries`), a Pantry add (`addPantryIngredients`, its food locks taken in one order). Every write of several grocery rows (create, update, reorder, delete, mark a Store done, delete its done) takes `lockGroceryList` first: without it an edit holding its row while it moves the list deadlocked any of them (the realtime run hit it with a create; `groceries-create.test.ts` reproduces each).
- A split row's id is the usual `id ?? crypto.randomUUID()`: `typedParts` hands back rows, the first keeping the caller's id.
- `POST /groceries` answers with every grocery the name became, a list. Breaking for API clients: the release note goes to ticket 09.
- Browser: the realtime project's Pantry add is now "realtime-kaas or realtime-ham", and both foods are in the Pantry. It waits for the background rename before the next write, which would otherwise move the renamed row to a newer version and leave the rename stale.
