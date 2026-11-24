# 06: Recipe pickers create explicitly

**What to build:** The Tag, Cuisine and Category pickers in the recipe editor, on web and mobile, show the household's existing entries first as you type. A new entry is only created through an explicit "Create 'x'" row. Editing another household's recipe offers that household's list. See the spec, "Tags, Cuisines and Categories".

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] **Web** pickers: `apps/web/components/shared/tag-input.tsx`, the category chips, and the cuisine picker in `apps/web/features/recipes/components/editor/provenance-fields.tsx`.
  - Existing entries match on the folded name.
  - "Create 'x'" appears only when no entry folds alike.
  - Typing and saving never creates an entry on its own.
- [ ] **Mobile:** the same behaviour in the editor's tag, category and cuisine cards (`apps/mobile/src/features/recipe/components/editor/`).
- [ ] **Another household's recipe:** the pickers read the recipe's household list, not the editor's.
- [ ] **Copy** in all locales (`pnpm i18n:check`).
- [ ] **Tests:** E2E on web for creating a Tag and a Cuisine from the picker and picking an existing one by a different case. A mobile device check of the same.
