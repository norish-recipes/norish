# 17: The Library's routes, root and filters store

**What to build:** The cookbook page moves under `(library)` beside the dashboard, its URL unchanged. One layout renders library's root around both pages, and the root makes the filters store from the reader's cookie. The dashboard and a cookbook page keep sharing the filters, and the shell stops holding them. Each page keeps its own seeding layout, so a full load of a cookbook doesn't seed the dashboard's reads. The recipe page's back link names the Library's type from its route instead of the filters context. Nothing visible changes. See `.scratch/app-structure/spec.md`, "Library (the third feature)" and "State" (the per-page store).

**Blocked by:** 16 (`RecipesContext` read the filters from the shell)

**Status:** done

- [x] `app/(app)/cookbooks/[id]/` moves to `app/(app)/(library)/cookbooks/[id]/` with its layout, loading, page and cover route. `/cookbooks/<id>` and its cover URLs don't change.
- [x] The dashboard's page, loading and seeding layout move into `app/(app)/(library)/(dashboard)/`. That layout seeds today's week and `library.list` as `(library)/layout.tsx` does today.
- [x] `(library)/layout.tsx` reads the filters cookie and renders library's root (`features/library/library-root.tsx`) around both pages. The root mounts the list events and ratings hook that the two pages called in 16.
- [x] The filters store's shape and actions live in `shared-react/recipes`, made per page through its page-store context as the recipe page's store is. The root creates it once from the cookie's value and persists every change to the cookie and the browser's storage, as `lib/recipe-filters-storage-adapter.ts` does today, so the next full load renders under them.
  - The root also keeps the last filters for the document, search text included, so the search and the order survive leaving the Library and coming back.
- [x] Every filters reader on the dashboard and the cookbook page reads the store with a selector: the search input, type chips, heading, create button, filters, filters panel, library view and cookbook members. Changing one filter renders only what reads it.
- [x] The offline bootstrap renders the dashboard and the cookbook page under the same root, with the filters from the browser's storage as today.
- [x] `useBackDestination` takes the Library's type as a value instead of reading a context. The recipe route reads it from the cookie and the offline bootstrap from the browser's; the cookbook page passes the store's.
- [x] `createRecipeFiltersContext`, web's `RecipesFiltersProvider`, its binding and `AppSeed.recipeFilters` are deleted. The shell no longer reads the filters cookie, and nothing in web or shared-react imports the filters context.
- [x] `recipe-filters-context.test.tsx` becomes the filters store's test: made from a cookie's value, it holds what its actions set. `filters-panel.test.tsx` renders under a store instead of mocking the context.
- [x] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm format:check`, `pnpm deps:cycles`, and mobile's lint, typecheck, test and `expo export --platform ios`.
