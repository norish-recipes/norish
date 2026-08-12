# 07 — Floating app chrome goes solid

**What to build:** Everything that floats over the page stops pretending to be glass and becomes a real object: an opaque surface fill, a border, a shadow. Text on it is legible whatever happens to be scrolling underneath, and there is no blur compositing while a reader scrolls their library on an older phone.

This is the app chrome half of ADR-0020. The half that sits over photos and video is ticket 08, and the bottom bar is ticket 09 because it changes shape as well as fill.

**Blocked by:** 01 (warm theme tokens).

**Status:** ready-for-agent

- [ ] The filters surface, the timer dock, panels, grocery list headers, the empty states on the library and grocery lists, the Tag skeleton and the auth error page all render on an opaque surface with a border and a shadow.
- [ ] None of them uses a blur utility or a see-through fill.
- [ ] Text and icons on each remain legible over a busy scrolling list in both themes.
- [ ] The timer dock reads correctly in both its collapsed and expanded shapes.
- [ ] Modal backdrops that dim the page are left alone — a scrim over content is not a surface pretending to be a material.
- [ ] The shared glass tokens still exist at the end of this ticket; they are deleted in ticket 14 once nothing imports them.
