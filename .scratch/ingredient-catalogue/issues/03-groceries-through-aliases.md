# 03: Groceries and recurring groceries through aliases

**What to build:** Groceries and recurring groceries point at an alias. A grocery typed by hand, a recurring grocery, a grocery added from a recipe and a grocery added offline (resolved on Replay) all resolve through the resolver and keep their free-text name as the as-written text shown on the list. "Uien" typed on a phone resolves to the same Ingredient as "onions" from a recipe. This is the *migrate* step for groceries: existing rows are resolved from their name, and store and aisle lookups still use the folded-name keys until 04.

**Blocked by:** 01

**Status:** done

- [x] Grocery create and rename, and recurring grocery create and rename, resolve through the resolver and store the alias.
- [x] A grocery from a recipe line takes that line's alias.
- [x] Replaying an offline create or rename resolves on the server. Replay stays idempotent.
- [x] Existing groceries and recurring groceries gain an alias in a migration, and the text shown on the list is unchanged.
- [x] Grocery merging of same-unit adds still behaves as before.

## Comments

- Resolution lives in `resolveGroceryNames` (`packages/shared-server/src/ingredients/groceries.ts`): a grocery added from a recipe line under that line's own text takes the line's alias; one renamed on its way to the list is resolved from its new text.
- "Uien" and "onions" only meet once the seed (10) or a Decision (06) knows they are one food; without them they resolve to two Ingredients.
- The alias stays off every client-facing grocery schema: clients read and write text, and the server never takes an alias from a client.
