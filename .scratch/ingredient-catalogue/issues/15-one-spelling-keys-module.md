# 15: One spelling-keys module for client and server

**What to build:** The server keys aliases with `ingredientAliasFold` (`foldName(text) || text.trim().toLowerCase()`) and matches rung 2 via `stripPreparation`, both in `packages/shared-server/src/ingredients/resolver.ts`. The client's offline and unresolved fallbacks use bare `foldName` and have no rung 2. Those fallbacks are `packages/shared/src/lib/pantry.ts` (`pantryIngredientFor`), `apps/web/hooks/stores/use-ingredient-for.ts`, `apps/web/components/groceries/dnd/drop-plan.ts`, and `apps/web/components/groceries/pantry/pantry-panel.tsx`. The result: "onions, diced" typed offline isn't covered by a Pantry "onions" until it syncs, and a punctuation-only name folds to `""` on the client. `drop-plan.ts` uses the fold as a grouping key rather than a match, so rung 2 there also merges the "onions, diced" and "onions" groups; that is intended, as it is the same Ingredient once resolved.

Move the fold, the preparation stripping and the resolver's private `spellingOf()` (`resolver.ts`, already answering `{ fold, bareFold }`) into `@norish/shared/lib` as its spelling-keys function. Server rungs 1–2 and every client fallback use it.

**Blocked by:** none

**Status:** done, pending gates and review

- [x] One module in `packages/shared` defines the fold and the preparation stripping; `resolver.ts` imports them.
- [x] Client fallbacks match on both keys; a table-driven test covers offline = online for the known cases.
- [x] ADR-0037 gets a note that unresolved client matching now includes rung 2.
- [x] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.

## Comments

- From the 2026-09-30 architecture review. Changing the client fallback is a matching-policy change, so it needs the ADR note.
- 2026-09-30 implemented: `@norish/shared/lib/spelling-keys` holds `ingredientAliasFold`, `stripPreparation`, `spellingKeys` (the resolver's former `spellingOf`) and `foodKey`, the one key the client fallbacks match on. The case table is `packages/shared/__tests__/lib/spelling-cases.ts`, checked offline by `pantryIngredientFor` and online by the real resolver (`shared-server/__tests__/ingredients/spelling-keys.test.ts`). The Pantry panel's `data-pantry-ingredient` attribute keeps the plain fold: it names the row, it matches nothing.
