# 06: Discover: Recent Searches, Categories, Quick filters, Tags

**What to build:** The no-text states (boards SrFocused, SrBrowse).

**Blocked by:** 05

**Status:** ready-for-agent

- [x] Recent Searches: a confirmed text (search key, "Search for" row) is kept on the device per account, newest first, 10 at most, no duplicates; text only. Tapping re-runs it and shows Results; ↖ puts it in the field; **Clear** empties the list. Wiped at sign-out, through whatever clears the per-account Offline Cache. Unit tests for the list rules.
- [x] Server: up to 4 Categories that hold a recipe the reader can see, built-ins first in their fixed order, each with the newest such recipe's primary image (`PRIMARY_IMAGE_SQL`); the 12 most-used Tags over recipes the reader can see. Repository tests.
- [x] Categories section (photo tiles), shown focused and browsing; Quick filters (Favorites, Under 30 min, 4 and up, Ingredients at home → favourites, `maxCookingTime` 30, `minRating` 4, pantry only) and Tags shown with the keyboard down. Favorites and 4 and up hide per `useHiddenItemVisibility`. A tap toggles the chip and shows Results.
- [x] i18n in every locale; gates green.

## Comments

Implementation (2026-11-20):
- Server: one procedure, `library.discover` (no input; `LibraryDiscoverSchema`), `listLibraryDiscover` reusing `namesOnVisible` for Tags and `PRIMARY_IMAGE_SQL` for the photo. Image: the newest visible recipe *that has an image* (falls back past a bare newest one); null when none does. The rest after the built-ins sort by name.
- Recent Searches: rules in `utils/recent-searches.ts` (trim, case-insensitive repeat moves to the top with the latest spelling, 10, blank ignored); kept as the cache manager's new per-owner `ownerData` (`owner-data:<owner>:recent-searches` in the Offline Cache's keyval), so the sign-out wipe, an account switch and a manual wipe clear it with the reads; module-scope store follows `cache.owner()`. Only the search key and the "Search for" row (`submitted`) keep a text.
- Sections: `discoverSections` (Recent only when non-empty; Categories/Tags only with data, a loading one shows its skeleton; Quick filters and Tags only with the keyboard down). A pick blurs the field. `library.discover` is persisted a week like `library.list`.
- Board deviations: no gradient package, so the tile scrim is a flat 35% black; Quick filter icons use ToggleChip's warning colour (board: muted, star coloured); ↖ is `arrow-up` rotated; an applied tile reads "✓ name" (unreachable today: a chip means Results show).
- Not done: nothing seen on a device; a manual cache wipe leaves the in-memory Recent list until relaunch (its stored copy is gone). Gates all exit 0 (E2E and device pass later).
