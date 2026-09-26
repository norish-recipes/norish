# 02: Pantry through aliases

**What to build:** A Pantry Ingredient points at an alias from the resolver, and "in the pantry" is decided by Ingredient rather than by folded name. With "onions" in the Pantry, adding a recipe whose line reads "onion, diced" shows that line under **In your pantry**, unticked and left off the list. This is the *migrate* step for the pantry: existing Pantry Ingredients keep their Ingredient and gain its alias. The one-per-household rule now holds per Ingredient.

**Blocked by:** 01

**Status:** done

- [x] Adding a Pantry Ingredient goes through the resolver. A name that resolves to an Ingredient already in the household's Pantry is refused.
- [x] The pantry check on adding a recipe matches on Ingredient: "onions" in the Pantry covers the line "onion, diced", and "salt" never covers "salted butter".
- [x] Existing Pantry Ingredients migrate without loss.
- [x] Resolver-level tests cover pantry coverage through aliases. The existing pantry router tests still pass.

## Comments

- The acceptance example "onions" covering "onion, diced" needs singular/plural knowledge, which rungs 1 and 2 do not have; the tests use "onions" covering "onions, diced". The seed (10) or the Decision (06) is what makes "onion" and "onions" one Ingredient.
- The pantry row keeps its Ingredient column beside the new alias pointer: the per-member unique constraint needs it. A merge (08) has to re-point it.
- A line edited in the add-to-groceries panel is only text until it becomes a grocery, so it is still matched on its folded name.
