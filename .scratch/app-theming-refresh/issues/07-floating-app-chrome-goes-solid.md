# 07 — Floating app chrome goes solid

**What to build:** Everything that floats over the page stops pretending to be glass and becomes a real object: an opaque surface fill, a border, a shadow. Text on it is legible whatever happens to be scrolling underneath, and there is no blur compositing while a reader scrolls their library on an older phone.

This is the app chrome half of ADR-0020. The half that sits over photos and video is ticket 08, and the bottom bar is ticket 09 because it changes shape as well as fill.

**Blocked by:** 01 (warm theme tokens).

**Status:** done

- [x] The filters surface, the timer dock, panels, grocery list headers, the empty states on the library and grocery lists, the Tag skeleton and the auth error page all render on an opaque surface with a border and a shadow.
- [x] None of them uses a blur utility or a see-through fill.
- [x] Text and icons on each remain legible over a busy scrolling list in both themes.
- [x] The timer dock reads correctly in both its collapsed and expanded shapes.
- [x] Modal backdrops that dim the page are left alone — a scrim over content is not a surface pretending to be a material.
- [x] The shared glass tokens still exist at the end of this ticket; they are deleted in ticket 14 once nothing imports them.

## Comments

- Implemented on `feat/improve-styling-and-consistency` (working tree; Mike commits). Empty states (library ×2, grocery ×2), the auth error card, the Nora 404/offline card and the timer dock are `bg-surface` + `border-border` + shadow; the grocery store/recipe sections became solid cards (surface, border, shadow) with their colour tint now sitting on the card instead of floating over the page. The filters button lost its unreachable `isGlass` branch and prop. The Panel's `blur` backdrop variant is gone — the default is now the `bg-(--backdrop)` dim scrim (same family as modal backdrops, which stay), and the sheet gained a border; `panel.test.tsx` updated accordingly.
- Two deviations worth knowing: the Tag skeleton was deleted rather than restyled (`TagsSkeleton` had zero import sites — dead code); and the timer dock's both-shapes check is by inspection + gates only — I could not drive a live timer in the screenshot harness. The shared glass tokens still exist by design; ticket 14 deletes them now that nothing imports them.
