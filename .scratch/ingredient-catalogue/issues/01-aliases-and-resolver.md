# 01: Aliases and the resolver: exact, stripped, mint

**What to build:** Introduce the Ingredient Alias and the resolver, the one module in `packages/api` allowed to mint Ingredients and aliases. Every existing `ingredients` row becomes an Ingredient with its own name as its first alias. Recipe save and import resolve each line's as-written text by trying, in order: an exact alias match on the fold, the fold with the text after the first comma and any bracketed text removed, and finally a newly minted Ingredient. Importing "2 onions, diced" next to an existing "onion" resolves to that onion. The recipe line keeps its text as written in a new column and still reads "2 onions, diced". This is the *expand* step: the alias pointer lives beside the existing ingredient pointer and folded-name keys, and nothing downstream changes yet. A mint made without an AI step is flagged. See `.scratch/ingredient-catalogue/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] The `ingredient_aliases` table exists with its text, fold (unique), optional locale, Ingredient, nullable owner and seeded marker. `ingredients` gains a nullable owner and a flagged marker.
- [x] A migration gives every existing Ingredient its name as an alias. Recipe lines point at an alias and carry their as-written text, and the display is unchanged for existing recipes.
- [x] Resolution order rungs 1, 2 and 4 are implemented, and every recipe-minting path goes through the resolver.
- [x] A mint records its owner (the acting user) and is flagged.
- [x] Resolver tests run in `packages/api` against a real database (testcontainers) under the existing test gate.
- [x] CONTEXT.md gains Ingredient, Ingredient Alias and Flagged Ingredient. "Ingredient Name" is retired.
- [x] An ADR records *ingredient identity is an alias pointing at an Ingredient*.

## Comments

- The resolver lives in `packages/shared-server/src/ingredients/`, not `packages/api`: the tRPC routers, queue workers and archive importer all save recipes and none may import `@norish/api`. Its tests run in `packages/shared-server` (testcontainers) under the existing gate; the upgrade backfill's tests run in `packages/api`.
- Rungs 1 and 2 are fold-exact, so "onions, diced" joins a known "onions" but not a known "onion": singular/plural is for the seed (10) and the Decision (06).
- A mint names the Ingredient for the text without its preparation and keeps that bare text as a second alias, so "onions, diced" first and "onions" later are one food.
