# 06 — Library view switch moves onto Tabs

**What to build:** The grid and list switch above the recipe library stops being a one-off control and becomes a real tab control, matching the tabs already used in settings and cooking mode. It gains standard keyboard behaviour along the way. In 3.2.4 the tab list container gained the filled pill appearance that the handrolled control existed to provide, so the handrolled one goes.

Settings also drops its hand-rolled horizontal overflow handling in favour of the component's own, which the same release added — so on a narrow phone a reader can see there are more settings sections to scroll to.

**Blocked by:** 02 (HeroUI 3.2.4).

**Status:** done

- [x] The library view switch is a tab control, with the grid and the list each in a real tab panel so the tab list has something to control.
- [x] It looks like the rest of the app's tabs and keeps its current compact size, including the icon-only presentation on narrow screens.
- [x] Arrow keys move between grid and list as they would in any tab control, and the selection is announced correctly.
- [x] Switching still persists the reader's choice as it does today.
- [x] Settings tabs use the component's built-in overflow affordances, and on a narrow phone it is visible that there are more sections than fit.
- [x] The handrolled segmented control is deleted, not left beside its replacement. It has exactly one consumer.
- [x] Cooking mode's tabs are untouched.

## Comments

- Implemented on `feat/improve-styling-and-consistency` (working tree; Mike commits). The switch is `Tabs.ListContainer/List/Tab` in `recipe-view-mode-toggle.tsx` with the `Tabs` root in `dashboard.tsx`, so the grid and list presentations sit in real `Tabs.Panel`s; `RecipeGrid` now takes its `variant` from its panel instead of context, and the `useDeferredValue` relayout trick went with it — a switch swaps panels rather than re-laying out in place. Verified in the browser: ArrowRight moves Grid→List, `aria-selected` follows, and the `norish_recipe_view_mode` cookie is written as before. Compact size and the icon-only sub-`sm` presentation are kept. `components/ui/segment.tsx` deleted; cooking mode untouched (walked through by hand).
- Settings dropped `overflow-x-auto`/`w-max` for the component's scroller. One catch: `useScrollShadow` only re-measures when the scroller resizes or scrolls, not when its content grows, so the Admin tab popping in after the role query never flipped `data-right-scroll`. The list is now keyed on the tab set so it remounts and re-measures; verified the chevron shows on a 390px viewport with four tabs. Ticket 20 (admin tab from the session) will make that pop-in disappear entirely.
