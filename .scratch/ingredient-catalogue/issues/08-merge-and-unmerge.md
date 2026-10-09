# 08: Merge and unmerge

**What to build:** On the Ingredients page, *merge into…* moves every alias of one Ingredient onto another and deletes the source. Every recipe line, grocery and Pantry Ingredient behind those aliases now means the target, with no re-pointing. Where both Ingredients have a Product Link, Aisle Link or store preference at the same Store, the target's is kept. *Move alias to…* is the unmerge: it moves one alias to another Ingredient, or to a new one. Merging needs `edit` on both Ingredients, and moving an alias needs `edit` on the alias. Merge, alias move and rename publish one broadcast *ingredients changed* event, and clients refetch ingredient-derived data idempotently. A housemate's merge refiles your list at once.

**Blocked by:** 04, 07

**Status:** done

- [x] Resolver tests: merging "uien" into "onion" files a grocery typed "uien" in onion's Aisle, collisions keep the target's links, and moving an alias back restores what it resolves to.
- [x] A merge clears the source's flag by removing the source. Moving an alias out of a flagged Ingredient leaves the flag alone.
- [x] Policy tests cover merge needing both Ingredients and alias moves.
- [x] The broadcast event is in the realtime catalogue, and its handlers merge by id.

## Comments

- `mergeCatalogueIngredients` and `moveCatalogueAlias` (`packages/db/src/repositories/ingredient-catalogue.ts`) re-point the Ingredient column that groceries, recurring groceries and Pantry Ingredients keep beside their alias, in the same transaction. Rows unique on (Store or member, Ingredient) — Product Links, Aisle Links, store preferences, Pantry Ingredients — keep the target's where both exist; a member who held both foods in the Pantry keeps one Pantry Ingredient. The household-wide one-per-household Pantry rule is not re-applied after a merge: two members may each hold the merged food.
- A merge of a source into itself is refused (`same-ingredient`); moving an Ingredient's last alias away is refused (`last-alias`): that is a merge, and a merge needs `edit` on both.
- *Move to a new Ingredient* mints it named for the alias, owned by the mover and **not** flagged (a person chose it). A name another Ingredient already goes by is refused (`name-taken`).
- Moving an alias needs `edit` on the alias only, as the spec says; the target Ingredient's policy is not asked. The picker offers every Ingredient for a move but only editable ones for a merge.
- The broadcast is `ingredients.changed` with the Ingredient ids; `useIngredientsSubscription` (mounted once in the app shell) refetches the ingredient list, groceries, Pantry, aisle links, grocery prices and product links. Add alias, remove alias and mark distinct do not publish: they change no line's food.
- Rung 3 can answer "same as X" for an X merged away while it was asked; the resolver then mints the text flagged instead of failing the save.
- The upgrade backfill now merges a pre-catalogue Ingredient whose own name folds like an older one's into it (review finding: it was left with no alias at all).
- Not handled: a store-lookup job queued for the source Ingredient before its merge will fail its link write on the foreign key. Rare, and left as is.
