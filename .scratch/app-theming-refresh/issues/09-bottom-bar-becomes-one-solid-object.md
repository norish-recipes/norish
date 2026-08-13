# 09 — The bottom bar becomes one solid object

**What to build:** On a phone the floating bottom bar becomes one object instead of two pieces that happen to line up: the account avatar joins the navigation items as a fourth entry rather than living in its own circle beside them. It is solid — surface fill, border, shadow — and the section the reader is in is marked with a filled pill behind it, not only by turning the label green.

Everything that already works about it is kept: it still gets out of the way as you scroll down a long recipe, it still stays put while the account menu is open, and it still clears the home indicator.

**Blocked by:** 01 (warm theme tokens).

**Status:** done

- [x] The bar is a single object containing home, groceries, calendar and the account avatar.
- [x] It renders on an opaque surface with a border and a shadow, and uses no blur or see-through fill.
- [x] The active section carries a filled pill behind it, legible at a glance without reading the labels.
- [x] Auto-hide on scroll behaves as it does today, including staying put while the account menu is open.
- [x] Safe-area spacing is preserved — the bar never sits under the home indicator.
- [x] Tapping home while already on home still scrolls the library to the top.
- [x] The account menu opens correctly from its new position inside the bar: it is not clipped, it is positioned against the right anchor, and focus lands where it should. This repo has known trouble with popovers inside panels and with menus that re-render mid-exit and steal focus, so this needs verifying by hand rather than assuming.
- [x] The backdrop that blocks page interaction while the menu is open still works.

## Comments

- Implemented on `feat/improve-styling-and-consistency` (working tree; Mike commits). One pill: the three nav items plus the avatar (`NavbarUserMenu` gained a `size="sm"` trigger) inside `bg-surface` + `border-border` + the desktop bar's soft shadow; the active section carries a `bg-accent-soft` filled pill. Auto-hide, stay-put-while-menu-open, safe-area spacing and tap-home-scrolls-top are untouched code paths.
- The account menu was verified by hand in the browser as the ticket demanded: it opens above the bar unclipped, focus lands in the menu (`role=menu` active element), the `bg-black/30` backdrop is present and dismisses, and the bar stays put underneath. No sign of the panel-portal or focus-steal issues from its new anchor.
- Revised after Mike's review (2026-08-13): the avatar went back to its own circle beside the bar — one object read as too cramped. Both pieces share one treatment (`bg-default` so the bar separates from the white cards scrolling under it, border, soft shadow), the bar grew to h-14 with icon-only items (labels live in `aria-label`/`title`), and instead of hiding on scroll the bar scales down to 0.88 from its bottom edge and stays put. Menu anchoring, backdrop and stay-put-while-open re-verified in the browser.
- Second revision (2026-08-13): the floating chrome now stands on the opposite theme's ground — a `chrome-inverted` class in web's globals re-declares the ground tokens swapped across themes (values mirror heroui-theme.css), so the bar is a dark warm pill over light and a light one over dark, always contrasting with the cards. The pill shrank to a compact icon hug (h-12, icons only) and gained a settings cog; the scroll scale-down deepened to 0.8. The desktop floating recipe chip takes the same inverted treatment.
- Third revision (2026-08-13): the inversion moved into the shared theme as a first-class `--chrome*` token family (`chrome`, `-border`, `-foreground`, `-hover`, `-muted`) — each theme block carries the other's ground values, exactly like every other token pair, with Tailwind utilities mapped in the same file. The bar keeps the compact h-12 icon row but spans the full width again, items spread evenly.
