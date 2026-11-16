# 35: Recipes tab refinement

**What to build:** The Recipes tab's accessory, toggles, tags, swipe rows and motion. See `.scratch/mobile-redesign/spec.md` Part 6 ("Rules", "Recipes tab").

**Blocked by:** none

**Status:** open

- [ ] The accessory reads Add cookbook while the library shows Cookbooks and opens the new-cookbook sheet; the library's own plus button goes.
- [ ] The avatar sits in a glass container.
- [ ] The Recipes/Cookbooks and grid/list toggles animate their selection with a haptic; the heading word rolls; the content swaps without a morph.
- [ ] Grid cards: every tag, allergens first, in a sideways-scrolling row (web's `recipe-tags.tsx`).
- [ ] Opening a swipe row never scrolls the list (`revealRow` in `card-list.tsx` goes); an open row closes on scroll or a tap anywhere else.
- [ ] Motion: press feedback on cards, pills and chips; the selection bar slides up; rows animate in, out and on reorder; haptic at the swipe threshold.
- [ ] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.
