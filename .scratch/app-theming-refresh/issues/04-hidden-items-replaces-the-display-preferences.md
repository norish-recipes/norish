# 04 — Hidden Items replaces the display preferences

**What to build:** One control in settings for everything a reader would rather not be shown, replacing the column of separate switches. A reader picks several at once from a single multi-select; everything is shown by default.

After this ticket the three things that are hideable today — ratings, favourites and the measurement conversion control — behave exactly as they do now, but they are driven by the new Hidden Item list and chosen from one control instead of three switches. Hiding applies wherever the thing appears, which for ratings and favourites means the recipe page, the library cards and the filters panel, exactly as today.

The list also carries the three recipe page sections, which ticket 12 wires up.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

The stored shape, which came out of the design session. Absent or empty means everything is shown; an unrecognised entry is ignored, so a future hideable item costs nothing at the contract level.

```
hidden: ("provenance" | "nutrition" | "notes"
       | "rating" | "favorites" | "conversion")[]
```

- [ ] Settings shows a single multi-select listing all six hideable items, replacing the ratings, favourites and conversion switches.
- [ ] Nothing is hidden by default, for existing readers and new ones alike.
- [ ] Hiding ratings removes the recipe page's rating section, the library card's rating chip and the filters panel's rating filter — the same reach as today.
- [ ] Hiding favourites removes the heart wherever it appears and the favourites filter — the same reach as today.
- [ ] Hiding the conversion control removes it from the recipe page.
- [ ] The three legacy display booleans are gone from the preferences contract and from every consumer. There is deliberately no fallback read and no backfill migration: a reader who had previously hidden ratings or favourites sees them once more and can re-hide them.
- [ ] Choices follow the reader between devices.
- [ ] The timers switch, the language select and the today's-meals select are untouched and still work. Timers is a capability with an administrator gate, not a display choice; today's-meals is a three-state placement rule stored on the device.
- [ ] Hiding changes only that reader's view — another member of the household still sees everything.
- [ ] Page-level tests cover which sections a recipe page renders for a given hidden list. The settings suite's three switch tests become tests that the multi-select writes the right list and reflects what is stored, and its timers, language and today's-meals tests keep passing untouched.
- [ ] The filters panel suite and the user router suite pass with fixture updates only — unchanged behaviour is the point.
