# 18: Save an Ingredient draft as one unit

**What to build:** `apps/web/app/(app)/settings/ingredients/components/ingredient-panel.tsx` (713 lines, 10 mutations, 4 of them in the save) saves a draft as a sequence of calls: rename, then set parent, then each alias removal, then each alias addition. It stops at the first refusal and prunes its local `added`/`removed` state to match, so a refusal partway through leaves the draft half-applied. The ordering can only be tested through the 1066-line render test (`apps/web/__tests__/app/settings/ingredients-settings-content.test.tsx`).

Add a server procedure `ingredients.saveDraft({ id, name, parentId, add, remove })` that applies the whole draft in one transaction, calling 16's edits with a shared `tx`, and returns either applied or the refusal. The panel sends one mutation.

**Blocked by:** 16

**Status:** done, pending gates and review

- [x] A refused draft changes nothing (server test).
- [x] The panel uses one mutation, and its draft reconciliation code is removed.
- [ ] The existing E2E `ingredient-catalogue.e2e.ts` still passes.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.

## Comments

- From the 2026-09-30 architecture review. The alternative is a client-side `useIngredientDraft` hook that can be tested without rendering, but it would keep the half-applied state.
- 2026-09-30 implemented: `ingredients.saveDraft({ ingredientId, name?, parentId?, add, remove })`; an omitted name or parent is left as it is, and a spelling to remove must be this Ingredient's. The `rename`, `setParent`, `addAlias` and `removeAlias` procedures stay: the procedure test pins the edit policy through them, though the web no longer calls them.
