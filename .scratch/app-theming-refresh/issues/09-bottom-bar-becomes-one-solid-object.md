# 09 — The bottom bar becomes one solid object

**What to build:** On a phone the floating bottom bar becomes one object instead of two pieces that happen to line up: the account avatar joins the navigation items as a fourth entry rather than living in its own circle beside them. It is solid — surface fill, border, shadow — and the section the reader is in is marked with a filled pill behind it, not only by turning the label green.

Everything that already works about it is kept: it still gets out of the way as you scroll down a long recipe, it still stays put while the account menu is open, and it still clears the home indicator.

**Blocked by:** 01 (warm theme tokens).

**Status:** ready-for-agent

- [ ] The bar is a single object containing home, groceries, calendar and the account avatar.
- [ ] It renders on an opaque surface with a border and a shadow, and uses no blur or see-through fill.
- [ ] The active section carries a filled pill behind it, legible at a glance without reading the labels.
- [ ] Auto-hide on scroll behaves as it does today, including staying put while the account menu is open.
- [ ] Safe-area spacing is preserved — the bar never sits under the home indicator.
- [ ] Tapping home while already on home still scrolls the library to the top.
- [ ] The account menu opens correctly from its new position inside the bar: it is not clipped, it is positioned against the right anchor, and focus lands where it should. This repo has known trouble with popovers inside panels and with menus that re-render mid-exit and steal focus, so this needs verifying by hand rather than assuming.
- [ ] The backdrop that blocks page interaction while the menu is open still works.
