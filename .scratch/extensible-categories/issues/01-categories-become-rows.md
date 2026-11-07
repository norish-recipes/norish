# 01: Categories become rows, read from one list

**What to build:** Nothing changes for users: recipes still carry Breakfast, Lunch, Dinner and Snack. Underneath, Categories move from the `recipe_category` enum to `categories`/`recipe_categories` rows, and every hard-coded copy of the four reads the built-ins from one const or the household's list from one endpoint. See `.scratch/extensible-categories/spec.md`, "The model", and ADR-0040.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Schema in `packages/db-schema/src/schema/` with `categories` (unique `lower(name)`) and `recipe_categories`. The migration seeds the four built-ins, moves `recipes.categories` onto join rows, then drops the column and the enum. `slot_type` is untouched.
- [ ] A categories repository beside `repositories/tags.ts`: `listCategoryNamesForUsers(userIds)` (built-ins plus usage), attach-by-name inside the recipe save transaction (matcher first, then a case-insensitive row match), and orphan cleanup that keeps the built-ins. Rewrite the raw `::recipe_category[]` SQL in `recipes.ts:684`, `:1031`, `:1690`, `:1842`, `library.ts:148` and `recipe-enrichment.ts:47`/`:86` against the join.
- [ ] `RecipeCategory` becomes `string`. Zod schemas (`zod/recipe.ts:18`/`:194`, `recipe-shares.ts:164`, the `updateCategories` router, the random-recipe OpenAPI `category`) accept a trimmed name of 1–40 characters.
- [ ] A `config.categories` query that always takes the household branch (unlike `config.tags`).
- [ ] The web's hard-coded lists (`recipe-form.tsx:38`, `filters-panel.tsx:28`, `filter-contract.ts` `VALID_CATEGORIES`/`RECIPE_CATEGORY_OPTIONS`) read the built-ins const or `config.categories`. Built-ins keep their i18n label and icon. Any other name renders verbatim with one generic icon.
- [ ] Tests:
  - [ ] the migration keeps every recipe's categories
  - [ ] a household list never includes another household's Category under the "everyone" policy
  - [ ] orphan cleanup spares the built-ins
  - [ ] "ontbijt" and "BREAKFAST" both attach the built-in
