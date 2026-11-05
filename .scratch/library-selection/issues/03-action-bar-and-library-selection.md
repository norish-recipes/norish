# 03: Action bar and selecting in the Library

**What to build:** the reusable action bar and the selection mode on the Library.

**Action bar:** a shared UI component replacing HeroUI Pro's ActionBar, which Norish can't use since Pro was removed.
- Shape: a root with `isOpen` (animated enter/exit, reduced motion respected) and optional Prefix / Content / Suffix sections with separators.
- Built on the HeroUI/react-aria toolbar and fixed at the bottom centre on the mobile nav's safe-area inset.
- Labels hide visually below the small breakpoint but stay announced to screen readers.
- Every button has a leading icon.

**Selection:** a hook/context owned by the page that hosts the grid, holding the selected recipe ids.
- **Entering:** a long-press on a recipe card (react-aria long-press, covering touch and mouse; the iOS callout and image drag are suppressed), or a **Select** item added to the card's swipe/ellipsis row.
- **While selecting:**
  - a press toggles the card instead of navigating;
  - swipe, double-tap-to-favourite and the heart are inert;
  - cookbook cards and pending (importing) cards are dimmed and inert;
  - selected cards look clearly selected.
- **The bar** shows the count and a clear button, and takes the place of the mobile nav and the desktop floating Library pill.
- **Leaving:** clear, Escape, the set becoming empty, or leaving the page.
- **What it survives:** search, filter, sort and grid/list changes, with the count including hidden recipes.
- **Pruning:** recipes deleted elsewhere drop out silently.

No actions yet beyond clear. There is no select-all.

See `.scratch/library-selection/spec.md`.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] E2E: long-press starts selecting; the Select row action starts selecting; tap toggles without navigating
- [ ] E2E: clear, Escape and deselecting the last card each end selection; leaving the page clears it
- [ ] E2E: selection survives a search change and the count includes hidden recipes
- [ ] E2E: at phone width the bar replaces the mobile nav; on desktop it replaces the Library pill
- [ ] A recipe deleted from another session leaves the selection; selection ends if it was the last
- [ ] Toolbar is labelled; icon-only buttons have aria-labels
- [ ] Gates green
