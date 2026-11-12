# 29: No tRPC in components

**What to build:** Every `useTRPC` call left in either app moves into a named hook in shared-react, in the domain it reads, and lint keeps it that way. After this ticket the whole E2E suite runs. Nothing visible changes. See `.scratch/app-structure/spec.md`, the rule against calling tRPC from a component under "State".

**Blocked by:** 25, 26, 27, 28

**Status:** done

- [x] Each remaining `useTRPC` and `useTRPCClient` call in web moves into a shared-react hook of the domain it reads:
  - groceries: the list and Pantry screens, the delete-store modal, `use-ingredient-for`, the store products' query and mutations;
  - recipes: the nutrition card, the worked-out nutrition, the share panel and the public share config;
  - offline: the offline recipe and cookbook pages, the offline status modal and the offline cache controller;
  - shared hooks: `use-recipe-prefetch` and `use-back-destination`.
- [x] The same goes for mobile's smoke screen, its i18n context and its offline engine.
- [x] Where a caller needs only a cache key or a prefetch, a shared-react helper builds it. Whatever can't move is named in the lint rule's exceptions, with one line of why.
- [x] Both apps' ESLint configs ban importing `useTRPC` and `useTRPCClient` from `@norish/shared-react/trpc` outside those exceptions.
- [x] Moved tests run against the hooks in their new homes.
- [x] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm format:check`, `pnpm deps:cycles`, and mobile's lint, typecheck, test and `expo export --platform ios`.
- [ ] The whole E2E suite (`ai`, `offline`, `realtime`) passes once, with no retries.

## Comments

- Implementation (98e5ab739..92acd5772): groceries' calls landed in `shared-react/groceries` (`useIngredientFor`, `useShopSearch`, `useProductLink`, `useStoreProducts`, `useChooseProduct`, `useStoreGroceryCount`, `useAisleLinksLoading`) and the Pantry's search in `ingredients` (`useCatalogueMatchesQuery`, `null` reads nothing); recipes' in `shared-react/recipes` (`useWorkedOutNutrition`, `useSharePublicConfigQuery`, share create with its toasts in `useRecipeShareMutations`); the offline pages, back link and prefetch read through `useHeldReads`, `useHeldRecipeName` and `usePrefetchRecipe` in `recipes`; `OfflineController` and `useOfflineStatus` call `useTRPC`/`useTRPCClient` themselves, so both apps drop the `trpc`/`transport` props; mobile's locale context saves through `useLocaleSave` in `reader`.
- Lint: `restrictTRPC(exceptions)` in `tooling/eslint/features.ts`, applied by both apps, tested in `features.test.ts`. No exceptions were needed.
- Deviations: `useShopSearch` and `useStoreProducts` keep their `enabled` argument. Splitting them into a fetcher mounted while asking and a held reader failed `grocery-prices` ("dragged into another Store") 3/3 runs: the field auto-took the answer to the untyped name during the typing debounce. The old single observer passes 32/32, so they moved verbatim (92acd5772). `useLocaleSave(signedIn)` takes a boolean, since `user.get` has no input for `null` to replace and the context sits above the platform adapter. The plain write, its `void mutateAsync` and the 60 s stale time are kept.
- The delete-store confirm reads its count from content mounted only while open, which also starts each opening on "keep". `useChooseProduct`'s reread and refusal toast moved into `useMutation`'s options (`showError`, same copy and log context). The share panel's create uses the hook's `createShare` (`answered`). The unused `NutritionGapEstimate` import and the moved hooks' memos went.
- E2E: the offline, pantry, grocery-prices and ingredient-linking (share page) specs pass, 49/49. No spec drives the share panel's create. The whole-suite box is the gatekeeper's.

- Review (Opus 5.5 xhigh on standards, Fable 5.2 high on spec, since the ticket touches offline sync), fixed in 65e7d7588..38475a80e. The spec axis compared every moved call with the code before the ticket and found each the same request; `OfflineController` and `useOfflineStatus` read the same tRPC context the apps read one level up, so each app keeps its client and link chain, and what the Warm Set warms and the cache manager persists is untouched.
- `useWarmSet` reads the proxy itself. One `useIngredientSearchQuery(search | null, locale, { listedOnly }?)` serves the Pantry and the pickers. `useIngredientFor` is web's (`features/groceries/hooks/`), composing `useIngredientsNamed` from `ingredients` with the own-Ingredient check, so the read is never stale until the catalogue's subscription marks it. `useHeldRecipeName` takes `null`. `DEFAULT_TIMER_KEYWORDS` and its cache times are `config/`'s, and `useSharePublicConfigQuery` takes a `select`. A failed locale save on mobile no longer rejects unhandled (test first). The lint test pins re-exports and type-only imports as banned.
- Rejected: `null` inputs for `useShopSearch` and `useStoreProducts` (the field shows a disabled observer's answer, and a reshaping of this path failed `grocery-prices` 3/3); reshaping `useLocaleSave(signedIn)` (a move, with no device tests in this run); dropping `restrictTRPC`'s exceptions parameter (the ticket asks for named exceptions); stripping hand-written memos from files only edited here; the cache-only flags in web's prefetch and back-link hooks.
- The whole-suite E2E box is ticked by the final pass.
