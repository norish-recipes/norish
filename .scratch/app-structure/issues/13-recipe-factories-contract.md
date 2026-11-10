# 13: Every other caller on the plain recipe hooks, and the factories go (contract)

**What to build:** The contract step of 11's wide refactor. Everything outside the recipe pages that still reads a recipe-domain binding imports `@norish/shared-react/recipes` directly: the dashboard's Library, the cookbook page, `RecipesContext` (which stays in the shell until library), the cookbooks realtime provider, the panels (filters, `MiniCookbooks`, `MiniCalendar`, `MiniRecipes`, after-planning), calendar, settings, the navbar, the import modals, the skeletons and `MiniGroceries`. Then the recipe-domain factories, web's bindings and shared-react's recipe exports under `./hooks` are deleted. Nothing visible changes. See `.scratch/app-structure/spec.md`, "shared-react".

**Blocked by:** 12

**Status:** ready-for-agent

- [ ] No app file imports a recipe-domain binding or factory, and web's recipes, library, favourites, ratings and cookbooks binding folders are gone.
- [ ] The recipe-domain factories and shared-react's `./hooks/recipes`, `./hooks/recipes/dashboard`, `./hooks/recipes/recipe`, `./hooks/cookbooks` and `./hooks/ratings` exports are deleted. `./hooks` and `./contexts` keep only what calendar, settings, imports and library still bind.
- [ ] `RecipesContext` and the cookbooks realtime provider read the plain hooks, and both stay in the shell until library.
- [ ] Web's hook tests for recipes, favourites and ratings, which test shared-react code, move into `src/recipes/__tests__/` and run against the plain hooks. The exports test follows the new subpaths.
- [ ] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm deps:cycles`, and mobile's lint, typecheck, test and `expo export --platform ios`.
