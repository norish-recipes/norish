# 14: Cookbooks

**What to build:** Cookbooks on mobile: the lens, the cookbook page and the whole set of cookbook actions. See `.scratch/mobile-redesign/spec.md` Part 2 ("Cookbooks") and ticket 07's cookbook board.

**Blocked by:** 10

**Status:** done

- [x] Moved first, in separate commits, web switched over with its unit tests: the edit flow of `CookbookEditContent` (staged rename, cover and removals in order, `isDirty`, cover off while offline) and the add-recipes picker of `cookbook-add-recipes-panel.tsx`.
- [x] `uploadCookbookImage` takes mobile's `expo-file-system` file as well as a `Blob`.
- [x] Cookbook page: the Library scoped to it under its cover and title, with Remove from cookbook on its cards.
- [x] Create from "+" and from a card's Add to cookbook; rename; delete; add recipes; upload a cover (`expo-image-picker`, library and camera).
- [x] The cookbook page and the picker paint cached data or a skeleton in their first frame; covers load on the device; sheets are glass with no solid footer.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- Moved three flows, not two: the edit flow (`useCookbookEdit`), the add-recipes picker (`useCookbookAddRecipes`) and the Add to cookbook membership flow (`useCookbookMembership`), which the sheet needs too. The web test `mini-cookbooks-save` moved into the hook's test with all four assertions. `uploadCookbookImage` needed no code change: an expo-file-system `File` is a Blob, and a device upload proved it.
- The cookbook page moved into the Recipes stack (`(tabs)/(recipes)/cookbook/[id]`, same URL) so its sheets present over it. Its menu is the native header's. The tab-bar accessory still reads "Add recipe" there, where the board draws "Add recipes".
- The board's cover fade is 58 bands of rising opacity: react-native-svg could not parse the theme colour and no gradient package is installed. Empty states carry no subtext, so the cookbook empty card is the title only.
- Not checked on the device: the camera (a simulator has none), the Cookbooks empty state (it needs the maintainer's cookbooks deleted), offline behaviour, and the final fade (58 bands) after the last build.
