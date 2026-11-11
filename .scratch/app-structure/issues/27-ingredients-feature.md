# 27: `shared-react/ingredients` and `features/ingredients`

**What to build:** The ingredient catalogue's reads and writes, called inline today by the Ingredients page and `components/ingredients/`, become plain hooks in a new `shared-react/ingredients`. The Ingredients page moves into `apps/web/features/ingredients`; `IngredientPanel` stays shared, since recipes, groceries and the Ingredients page open it. Nothing visible changes. See `.scratch/app-structure/spec.md`, "Settings (the fifth feature)" and the rule against calling tRPC from a component under "State".

**Blocked by:** 23

**Status:** ready-for-agent

- [ ] `shared-react/ingredients`, exported as `@norish/shared-react/ingredients`, is a feature: it imports no other feature, and lint enforces it. It holds the catalogue as plain hooks: the Ingredients page's list (infinite, keeping the previous page while the filters change), the kinds, the AI changes (`useAIChanges`, `isOpenChange`), an Ingredient and its writes (update, merge, delete, nutrition correction, icon), the spellings and the icons query. `use-ingredient-cache.ts`'s cache writes sit in the mutations' own options.
- [ ] Nothing in the Ingredients page or `components/ingredients/` calls `useTRPC`. The catalogue's subscription stays in `shared-react/config`.
- [ ] `features/ingredients` holds the Ingredients page: its content, list, row, search, filters panel, changed-by-AI panel, data sources card and `use-ingredient-tree`. `settings/ingredients/page.tsx` renders it. The page mounts the catalogue subscription, as before. `IngredientPanel` and what it draws stay in `components/ingredients/`.
- [ ] Tests: `ingredients-settings-content.test.tsx` and `ingredient-nutrition.test.tsx` run against the plain hooks; the page's tests live in `features/ingredients/__tests__/`. The E2E specs `ingredient-catalogue`, `catalogue-clean-up`, `catalogue-fill-gaps`, `ingredient-icons`, `pickers-on-phone` and `ingredient-nutrition` pass.
- [ ] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm format:check`, `pnpm deps:cycles`, and mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments
