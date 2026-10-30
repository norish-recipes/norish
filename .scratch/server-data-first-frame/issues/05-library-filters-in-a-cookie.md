# 05: Library filters in a cookie

**What to build:** The server knows the reader's Library filters on a full load, so it can ask for the same list the browser will.

- The web storage adapter (`apps/web/hooks/recipes/recipe-filters-storage-adapter.ts`) writes the filters to a cookie as well as localStorage. `app/(app)/layout.tsx` reads it, checks it with `normalizePersistedRecipeFilters` (`packages/shared-react/src/contexts/recipes/filter-contract.ts`), and hands it to the App Shell; `RecipesFiltersProvider` starts from it already hydrated. An optional prop, so the mobile app is untouched, and localStorage stays the fallback without a cookie.
- **Not on the profile:** a Device Preference is how Norish is shown, per Device Kind; filters belong to a browser, and every chip tap would be a profile write.
- Keep the cookie small: only what differs from the defaults.

**Blocked by:** 01.

**Status:** done

- [x] Unit: the stored filters round-trip through the cookie, and a malformed one falls back to the defaults.
- [x] The Library's first render on a full load uses the cookie's filters, with no hydration mismatch.

## Comments

- 2026-10-16, **built.**
  - **The cookie.** `lib/recipe-filters-cookie.ts`: `norish-recipe-filters` holds, URI-encoded, only the fields that differ from `DEFAULT_PERSISTED_RECIPE_FILTERS`, so a reader on the defaults sends `{}` (6 bytes). It is kept a year, like `norish-tz`. A malformed value reads as the defaults (`__tests__/lib/recipe-filters-cookie.test.ts`).
  - **Writing it.** The web storage adapter writes the cookie whenever it writes localStorage, and the defaults when the filters are cleared. Defaults are written as `{}` rather than deleting the cookie: no cookie means "the server doesn't know", and the provider then falls back to reading localStorage after mount.
  - **Reading it.** `lib/recipe-filters-server.ts` (`readRecipeFilters`, once per request) → `app/(app)/layout.tsx` → the App Shell → `RecipesFiltersProvider initialFilters`, which starts from them already hydrated and skips the storage read. The prop is optional, so the mobile app is untouched.
  - **Server-side imports.** The filter contract had no server-safe import path: `@norish/shared-react/contexts` pulls in `createContext`. `packages/shared-react` now exports `./filter-contract` directly, and the Library's and a cookbook's query inputs (`libraryListInput`, `cookbookRecipesInput`) moved into it, so the server builds the same keys the hooks do.
  - `first-paint.e2e.ts` loads the Library with a title-order cookie: its first card is the alphabetically first recipe, not the newest, and the page logs no hydration error.
