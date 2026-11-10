# 12: The recipe page and the shared recipe page on per-page stores

**What to build:** The recipe page's context becomes a per-page store. The page's provider makes it from the recipe id, and it holds the id, the servings the reader picked, the conversion choice and the wake lock. Every piece of the page reads the recipe, its shares, its ratings, the reader's favourites, its enrichment and the recipe's cookbooks through the plain hooks by id, so changing the servings renders only what shows amounts. The shared recipe page's provider becomes the same kind of store, holding the share token, the servings and the measurement system. The recipe page and the editor stop reading `RecipesContext`. Nothing visible changes. See `.scratch/app-structure/spec.md`, "State" (the per-page store) and "Recipes (the second feature)".

**Blocked by:** 11

**Status:** ready-for-agent

- [ ] The recipe page's store and its provider live in `shared-react/recipes`. The provider creates the store once with zustand's `createStore` from the page's recipe id and hands it down through a context that holds only the store; components read it with a selector. The live route and the offline bootstrap hand the page the same params, and a Warm Set recipe opens Offline as before.
- [ ] The page mounts the recipe's, its shares' and its enrichment's subscriptions once. Ratings stay in the shell until library.
- [ ] `createRecipeDetailContext` and web's detail context are deleted, with the wake-lock context, which folds into the store. The unread fields go: `liked`, `toggleLiked`, the context's own `userRating` and `rateRecipe`, `createShare`, `updateShare`, `refreshShares`, `shareError` and `reset`.
- [ ] The page's favourite and delete and the editor's create and update come from the plain hooks, with the same toasts and navigation as before. Nothing on the recipe page or in the editor reads `RecipesContext`.
- [ ] The shared recipe page's store sits with the share route and holds the token, the servings and the measurement system. The shared recipe and its units are read through hooks by token, so its provider holds no server data, and the share route's binding of the share hooks goes.
- [ ] Each store gets a unit test: made from its first value, it holds what its actions set. The detail context's test becomes the recipe page store's test plus tests of the hooks it covered.
- [ ] CONTRIBUTING's "App architecture" and the Architecture page state the per-page store rule, with its line of why: a module-level store is one object on the server, shared by every request. They stop saying that stores are always global and that a context injects a scope.
- [ ] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm deps:cycles`, and mobile's lint, typecheck, test and `expo export --platform ios`.
