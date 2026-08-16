# 05 — Personal marks and attribution travel

**What to build:** a user who exports keeps the marks they made: each `recipe.json` carries the exporter's own rating and favourite flag, plus the author's display name as attribution. On import, rating and favourite apply to the winning recipe for the importing user (favourite via ticket 01's loop extension); attribution is informational and ignored gracefully by the importer. Nobody else's marks and nobody's account data exist anywhere in the archive — it stays safe to hand around (ADR-0022).

**Blocked by:** 01 — Import loop carries a favourite beside the rating; 02 — A `.norishrecipes` file imports like any other archive; 03 — A user exports everything they can see.

**Status:** resolved

- [x] `recipe.json` carries the author's display name, the exporter's own rating, and the exporter's favourite flag
- [x] Only the exporter's marks are exported — never other users' ratings or favourites
- [x] Import applies rating and favourite to the winning recipe (matched or created) for the importing user; a missing or unknown author name never fails an import
- [x] No emails, avatars, preferences, or any other account data appear anywhere in the archive
- [x] Format-seam unit tests and the round-trip test extended for marks and attribution
