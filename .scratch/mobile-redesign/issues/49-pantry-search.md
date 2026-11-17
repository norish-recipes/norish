# 49: Pantry search and suggestions

**What to build:** Make the Pantry's search find foods the way recipe search does, and give Add to pantry web's suggestions. Reported by Mike on the device, 2026-11-17.

**Blocked by:** none

**Status:** ready

- [ ] Reproduce first: the Pantry field (`pantry-screen.tsx`, `usePantryScreen`) and the Add to pantry sheet (`pantry-add-screen.tsx`, `usePantryCatalogue`) on Mike's report that search "doesn't work". A failing test captures what breaks.
- [ ] Search matches partial hits (part of a word, any word of the name), as recipe search does; reuse the shared matcher recipe search uses rather than a new one.
- [ ] Add to pantry, with the field empty, lists the foods the household's recipes use often that the Pantry doesn't cover, as web does ("From your recipes", `usePantrySuggestions` in `@norish/shared-react/groceries`); tapping one keeps it.
- [ ] Unit tests for the matching and the suggestions; gates green; checked on the device.
