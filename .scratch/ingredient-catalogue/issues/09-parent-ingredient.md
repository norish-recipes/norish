# 09: Parent Ingredient

**What to build:** An Ingredient may have a Parent Ingredient ("red onion" under "onion"). It is set or changed on the Ingredients page under `edit`, and a change that would form a cycle is refused. What follows along the tree:
- A child with no Aisle Link at a Store is filed in its parent's Aisle.
- A child in the Pantry covers a recipe line for its parent, never the reverse.
- Product Links and grocery grouping ignore the tree.

The resolution Decision's *new, child of X* answer now sets the parent, and an unsure one also flags the new Ingredient. Setting a flagged Ingredient's parent clears the flag. A parent change publishes the *ingredients changed* event.

**Blocked by:** 02, 04, 06, 07

**Status:** done

- [x] Resolver tests cover the aisle fallback to the parent, no Product Link fallback, pantry coverage in both directions (including a grandchild) and cycle refusal.
- [x] The Decision's child-of answer sets the parent. An unsure child-of answer is flagged.
- [x] The page shows and edits the parent.
- [x] CONTEXT.md gains Parent Ingredient, and the Pantry Ingredient entry is rewritten. ADR-0036 is superseded or rewritten to cover the Ingredient and the child-covers-parent rule.

## Comments

- `ingredients.parent_id` (migration 0061), `ON DELETE SET NULL`. Every tree change (`setCatalogueIngredientParent`, a merge) takes one advisory lock on the whole tree, so two changes that are each acyclic cannot close a cycle together.
- The Aisle fallback is decided on the server (changed after review, at Mike's request; it was first built in the browser). `stores.aisleLinks` answers every Aisle Link plus, for each food on the household's list (groceries and recurring groceries) with no link of its own at a Store, its nearest ancestor's aisle there (`listInheritedAisleLinks`, one recursive query). The browser only looks the grocery's Ingredient up. It asks again when a filing lands (a filing moves the foods that inherit it) and when a food new to the list appears (not on a tick), and the filing mutation cancels an in-flight read so a stale answer never lands over it. The `ingredients.ancestors` query is gone.
- Known limit: a child filed only by inheritance cannot be dragged to "unfiled" — filing it nowhere deletes a link it does not have, and it still inherits. Filing it into another aisle works (it gets its own link).
- Pantry coverage rides on the Pantry DTO: each Pantry Ingredient carries `ancestorIds`, and `pantryIngredientFor` matches the line's Ingredient against the item's and its ancestors'. Ingredients-changed refetches the Pantry, so a parent change re-covers at once.
- A merge re-parents the source's children onto the target; where the target sat below the source, it first takes the source's place under the source's parent.
- A "kind of X" answer whose X was merged away while rung 3 was asking mints the new Ingredient with no parent (the insert reads the parent back in the same statement).
- The Decision answering "a kind of X" sets the parent; so does the language model's `kind-of`, flagged when it was not sure.
