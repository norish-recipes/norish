# 04 — Hidden Items replaces the display preferences

**What to build:** One control in settings for everything a reader would rather not be shown, replacing the column of separate switches. A reader picks several at once from a single multi-select; everything is shown by default.

After this ticket the four things that are hideable today — ratings, favourites, the measurement conversion control and recipe timers — behave exactly as they do now, but they are driven by the new Hidden Item list and chosen from one control instead of four switches. Hiding applies wherever the thing appears, which for ratings and favourites means the recipe page, the library cards and the filters panel, exactly as today, and for timers the recipe page, the library cards and the filters panel likewise.

Timers are the reader's own layer over the administrator's deployment-wide capability. When the administrator has switched timers off there is nothing to offer, so the control does not offer the entry — and a control never drops a stored choice it was not in a position to show: it writes back what the reader chose plus what it carried, which also keeps entries from a newer version safe.

The list also carries the three recipe page sections, which ticket 12 wires up.

**Blocked by:** None — can start immediately.

**Status:** done

The stored shape, which came out of the design session. Absent or empty means everything is shown; an unrecognised entry is ignored, so a future hideable item costs nothing at the contract level.

```
hidden: ("provenance" | "nutrition" | "notes"
       | "rating" | "favorites" | "conversion" | "timers")[]
```

- [x] Settings shows a single multi-select listing all seven hideable items, replacing the ratings, favourites, conversion and timers switches.
- [x] Nothing is hidden by default, for existing readers and new ones alike.
- [x] Hiding ratings removes the recipe page's rating section, the library card's rating chip and the filters panel's rating filter — the same reach as today.
- [x] Hiding favourites removes the heart wherever it appears and the favourites filter — the same reach as today.
- [x] Hiding the conversion control removes it from the recipe page.
- [x] Hiding timers removes the timer affordances everywhere they appear for that reader — the same reach the old switch had. The administrator's deployment-wide timers setting is untouched; hiding is the reader's layer on top of it.
- [x] The timers entry is offered only while the administrator capability has timers on. A stored choice the control cannot offer — timers while gated off, or an entry from a newer version — is carried and written back untouched, never dropped.
- [x] The four legacy display booleans, timers included, are gone from the preferences contract and from every consumer. There is deliberately no fallback read and no backfill migration: a reader who had previously hidden ratings, favourites or timers sees them once more and can re-hide them.
- [x] Choices follow the reader between devices.
- [x] The language select and the today's-meals select are untouched and still work. Today's-meals is a three-state placement rule stored on the device.
- [x] Hiding changes only that reader's view — another member of the household still sees everything.
- [x] Page-level tests cover which sections a recipe page renders for a given hidden list. The settings suite's four switch tests become tests that the multi-select writes the right list and reflects what is stored — including that a gated-off or unrecognised stored entry is carried, not dropped — and its language and today's-meals tests keep passing untouched.
- [x] The filters panel suite and the user router suite pass with fixture updates only — unchanged behaviour is the point.

## Comments

- Shipped in 6c849d7e. Settings offers one multi-select over the seven hideable items; the `hidden` list replaces the four display booleans across the contract and every consumer, with no fallback read and no migration (remaining `timersEnabled` hits are the deployment capability, not the retired boolean). The carried/selected split holds: a timers choice survives a write while the capability is gated off, and unrecognised entries ride along untouched. Settings, filters panel, user router and recipe page suites pass. Page-level section coverage here is the rating/unrecognised-entry/default slice; provenance, nutrition and notes join when ticket 12 wires those sections up.
- 2026-08-14: the "Choices follow the reader between devices" criterion is revised by ticket 23 — the list becomes a device preference on the `norish_hidden_items` cookie, per-device like every other visibility choice. Everything else in this ticket stands. See `.scratch/app-theming-refresh/issues/23-hidden-items-becomes-a-device-preference.md`.
