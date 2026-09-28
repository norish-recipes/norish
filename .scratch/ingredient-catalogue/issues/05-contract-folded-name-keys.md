# 05: Contract: remove the folded-name keys

**What to build:** Once the pantry, groceries and links all read through aliases, remove the old identity path. No code decides identity from `normalizedName` any more, and the old columns, indexes and fold helpers that only served identity are dropped. Recipe lines drop their direct ingredient pointer in favour of the alias. The app behaves exactly as it did after 02 and 04.

**Blocked by:** 02, 04

**Status:** done

- [x] No identity reads or writes remain on folded-name keys or on the recipe line's direct ingredient pointer.
- [x] A migration drops the obsolete columns and indexes.
- [x] Any fold helper left serves display or search only, and is named accordingly.
- [x] `pnpm lint`, `pnpm test:run`, `pnpm build` and the grocery and pantry E2E specs pass.

## Comments

- Migration 0060 drops `recipe_ingredients.ingredient_id` and `ingredients.normalized_name` with their indexes; the ingredient-name startup backfill is gone. A recipe line reads its Ingredient through its alias.
- The `normalized_name` of `store_product_links`, `aisle_links` and `ingredient_store_preferences` is **kept**, read by nothing but the upgrade's carry-over (`ingredient-backfill`). 01-05 ship in one release, and the upgrade runs at startup after every migration, so dropping it here would lose every link an instance carries over from 0.24. Drop it a release later, once every instance has run the upgrade.
- The Pantry DTO no longer carries `normalizedName`; the client folds a Pantry Ingredient's name itself where it still has to match text nothing has resolved yet (an offline add, a line edited in the add-to-groceries panel).
- `normalizeGroceryName` is now `foldName` (`@norish/shared/lib/fold-name`): it keys an alias through the resolver's `ingredientAliasFold` and otherwise serves search and display.
