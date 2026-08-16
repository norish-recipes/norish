# 08 — The round-trip is proven in a real browser

**What to build:** the one browser E2E the spec mandates, in the existing full-stack Playwright project: sign in, create a recipe with an image, export from settings, receive the streamed `.norishrecipes` download, feed it back through the import UI, and assert the round-trip lands — the recipe matches and overwrites, its media displays, and the importer's marks apply. One test exercising route auth, streaming delivery, and real media on disk in a single pass; per-format edge cases stay at the unit seam (tickets 02–06), not here.

**Blocked by:** 03 — A user exports everything they can see; 04 — Media travels inside the archive; 05 — Personal marks and attribution travel.

**Status:** resolved

- [x] One E2E test in the existing full-stack browser project covering sign-in → create → export → download → reimport → assert
- [x] The test asserts the match-and-overwrite outcome, media presence after reimport, and applied rating/favourite
- [x] The downloaded file is the real streamed response from the authenticated route, not a synthesized fixture
- [x] The test runs green under the standard E2E command alongside the existing suites
