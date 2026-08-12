# 06 — Library view switch moves onto Tabs

**What to build:** The grid and list switch above the recipe library stops being a one-off control and becomes a real tab control, matching the tabs already used in settings and cooking mode. It gains standard keyboard behaviour along the way. In 3.2.4 the tab list container gained the filled pill appearance that the handrolled control existed to provide, so the handrolled one goes.

Settings also drops its hand-rolled horizontal overflow handling in favour of the component's own, which the same release added — so on a narrow phone a reader can see there are more settings sections to scroll to.

**Blocked by:** 02 (HeroUI 3.2.4).

**Status:** ready-for-agent

- [ ] The library view switch is a tab control, with the grid and the list each in a real tab panel so the tab list has something to control.
- [ ] It looks like the rest of the app's tabs and keeps its current compact size, including the icon-only presentation on narrow screens.
- [ ] Arrow keys move between grid and list as they would in any tab control, and the selection is announced correctly.
- [ ] Switching still persists the reader's choice as it does today.
- [ ] Settings tabs use the component's built-in overflow affordances, and on a narrow phone it is visible that there are more sections than fit.
- [ ] The handrolled segmented control is deleted, not left beside its replacement. It has exactly one consumer.
- [ ] Cooking mode's tabs are untouched.
