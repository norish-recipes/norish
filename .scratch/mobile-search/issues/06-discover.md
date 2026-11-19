# 06: Discover: Recent Searches, Categories, Quick filters, Tags

**What to build:** The no-text states (boards SrFocused, SrBrowse).

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Recent Searches: a confirmed text (search key, "Search for" row) is kept on the device per account, newest first, 10 at most, no duplicates; text only. Tapping re-runs it and shows Results; ↖ puts it in the field; **Clear** empties the list. Wiped at sign-out, through whatever clears the per-account Offline Cache. Unit tests for the list rules.
- [ ] Server: up to 4 Categories that hold a recipe the reader can see, built-ins first in their fixed order, each with the newest such recipe's primary image (`PRIMARY_IMAGE_SQL`); the 12 most-used Tags over recipes the reader can see. Repository tests.
- [ ] Categories section (photo tiles), shown focused and browsing; Quick filters (Favorites, Under 30 min, 4 and up, Ingredients at home → favourites, `maxCookingTime` 30, `minRating` 4, pantry only) and Tags shown with the keyboard down. Favorites and 4 and up hide per `useHiddenItemVisibility`. A tap toggles the chip and shows Results.
- [ ] i18n in every locale; gates green.

## Comments
