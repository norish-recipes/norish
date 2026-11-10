# 11: The recipe domain as plain hooks (expand)

**What to build:** The whole recipe domain moves into `@norish/shared-react/recipes` as plain hooks: the list and library reads, the pending imports, the recipe mutations, favourites, ratings, shares, cookbooks, a recipe and its subscription, enrichment, conversion, images, videos, autocomplete, the random pick and the servings scaler. This is the expand step of a wide refactor (97 app files read these hooks today): each old factory hands back the same plain hooks, so every caller keeps working until 12 and 13 move them. Mobile's one recipe read moves now. Nothing visible changes. See `.scratch/app-structure/spec.md`, "shared-react" and "Recipes (the second feature)".

**Blocked by:** 10 (the cookbook hooks read the Reader's id)

**Status:** done

- [x] `@norish/shared-react/recipes` exports the plain hooks above, each importing `useTRPC`, the Reader and the platform adapter instead of taking them as options. `shouldPreserveOptimisticUpdate`, which no app passes, goes.
- [x] The domain's helpers stay inside it: the library cache that the recipe and cookbook caches update, and the `RecipeFilters` type the library and cookbook reads take.
- [x] `createRecipeHooks`, `createRecipeFamilyHooks`, `createRecipeShareHooks`, `createUseLibraryQuery`, `createFavoritesHooks`, `createRatingsHooks` and `createCookbookHooks` hand back the plain hooks and hold no logic of their own, and `createRecipeDetailContext` and `createRecipesContext` are fed them. Every web caller compiles and runs unchanged.
- [x] Mobile's recipe binding is deleted, and its smoke screen reads the recipe total through the plain list hook.
- [x] The dead hooks go: web's `useRecipeFilters`, `useCookbooksQuery` and `useCookbooksCacheHelpers`, and shared-react's unused `createUseAmountDisplayPreference`.
- [x] shared-react's enrichment, shares, recipes subscription, ratings subscription, cookbook list cache and servings suites move into `src/recipes/__tests__/` and run against the plain hooks.
- [x] Lint stops `recipes/` importing another domain, and `deps:cycles` stays clean.
- [x] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm deps:cycles`, and mobile's lint, typecheck, test and `expo export --platform ios`.
