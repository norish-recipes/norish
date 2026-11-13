# 14: Cookbooks

**What to build:** Cookbooks on mobile: the lens, the cookbook page and the whole set of cookbook actions. See `.scratch/mobile-redesign/spec.md` Part 2 ("Cookbooks") and ticket 07's cookbook board.

**Blocked by:** 10

**Status:** open

- [ ] Moved first, in separate commits, web switched over with its unit tests: the edit flow of `CookbookEditContent` (staged rename, cover and removals in order, `isDirty`, cover off while offline) and the add-recipes picker of `cookbook-add-recipes-panel.tsx`.
- [ ] `uploadCookbookImage` takes mobile's `expo-file-system` file as well as a `Blob`.
- [ ] Cookbook page: the Library scoped to it under its cover and title, with Remove from cookbook on its cards.
- [ ] Create from "+" and from a card's Add to cookbook; rename; delete; add recipes; upload a cover (`expo-image-picker`, library and camera).
- [ ] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.
