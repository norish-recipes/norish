# 06 — The format contract is hardened

**What to build:** the Recipe Archive behaves predictably at its edges, because the format is frozen the day archives exist in the wild. A user importing an archive whose cuisines this instance doesn't know sees those names reported as skipped instead of silently vanishing; an archive from a newer format major is refused with a clear error before anything imports; a corrupt or unparsable recipe entry fails alone with a per-entry error while the rest of the archive imports; and unknown fields within the current major are ignored, so the format can evolve additively.

**Blocked by:** 02 — A `.norishrecipes` file imports like any other archive.

**Status:** resolved

- [x] Dropped cuisine names surface in the import result's reporting, visible where the import UI already shows skips and errors
- [x] An archive declaring a newer `formatVersion` major is refused with a clear message and imports nothing
- [x] A corrupt recipe entry produces a per-entry error and does not prevent the remaining recipes from importing
- [x] Unknown fields in the manifest or a `recipe.json` within the current major are ignored
- [x] All four behaviours pinned by unit tests at the format seam
