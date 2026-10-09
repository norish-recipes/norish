# 04: Product Links, Aisle Links and store preferences keyed on the Ingredient

**What to build:** A Product Link, an Aisle Link and a store preference become facts about an Ingredient at a Store (for the preference, per user), no longer about a folded name. Filing "onion" in an Aisle files "onions, diced" and "uien" there too. A Product Link made for "onion" prices every alias of it, and a store preference for "milk" holds for "melk". A migration carries every existing link and preference over to the Ingredient whose alias has its fold. On a collision the most recently updated one wins. A fold that no alias matches mints an Ingredient, so no link is dropped. Store lookup, Decision suggestions and Line Cost read the link through the grocery's alias.

**Blocked by:** 03

**Status:** done

- [x] Product Links, Aisle Links and store preferences are unique on (store, Ingredient), or (user, Ingredient) for preferences.
- [x] Every writer and reader of these links goes through the Ingredient: grocery create, rename and move, store lookup, the aisle picker, and the preference writes on groceries and recurring groceries.
- [x] Migration tests cover carry-over, collisions and unmatched folds.
- [x] The existing grocery-prices, grocery-aisles and ingredient-linking E2E specs pass.
- [x] CONTEXT.md's Product Link, Aisle Link and Grocery entries are rewritten around the Ingredient. ADR-0031 is amended.

## Comments

- A Grocery and a recurring grocery keep their alias's Ingredient beside the alias (as recipe lines and Pantry Ingredients do), so every list read and `returning()` carries the food prices, aisles and preferences are keyed by. A merge (08) must re-point both columns on groceries, recurring groceries and pantry rows.
- The client looks prices and aisles up by `grocery.ingredientId`. A line added offline has none until the server resolves it on Replay, and is unpriced and unfiled until then.
- A grocery panel asking what a Store remembers for a name being typed goes through a new read-only `ingredients.find` query (exact or stripped alias match, never mints), through `useIngredientFor`.
- Store preferences keep their fuzzy fallback, now over the preferred Ingredients' names.
- Behaviour change surfaced by the grocery-aisles spec: "kip (diepvries)" strips to "kip" at rung 2, so it is one food with "kip" and cannot be filed in another aisle. The scenario now pins that; ADR-0031's amendment says so.
