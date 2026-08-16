# 04 — Media travels inside the archive

**What to build:** an exported recipe looks like itself after reimport. Hero and gallery images, step images, and videos with their thumbnails ride inside each recipe's folder in the archive, referenced from `recipe.json` by relative path; on import they are rehomed through the existing archive-media pipeline so the recreated recipe displays its media. Everything is always in — no include toggles (ADR-0022).

On export, media streams from disk through the zip without whole-file buffering, so a video-heavy export costs bandwidth, not memory.

**Blocked by:** 02 — A `.norishrecipes` file imports like any other archive; 03 — A user exports everything they can see.

**Status:** resolved

- [x] Hero, gallery, and step images plus videos and thumbnails are written into each recipe's folder and referenced by relative path from `recipe.json`
- [x] Export streams media from disk into the zip without buffering whole files in memory
- [x] Import rehomes archive media through the existing media pipeline; a round-tripped recipe displays its images and plays its video
- [x] A recipe with no media exports and imports cleanly
- [x] Format-seam unit tests extended: media entries, relative references, and the round-trip test covering a recipe with media
