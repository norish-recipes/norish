# 02 — A `.norishrecipes` file imports like any other archive

**What to build:** the tracer bullet. The Recipe Archive format exists and Norish reads it: a user handed a `.norishrecipes` file feeds it to the existing archive import flow and their library gains the recipes inside, with the same progress reporting, duplicate handling, and ownership semantics as every other archive format. The exporter does not exist yet — a fixture archive (hand-built or produced by the new archive writer in tests) is the demo vehicle.

Covers, per the spec and ADR-0022: the manifest and `recipe.json` shapes (core recipe data only — a superset of the importer's canonical insert shape with cuisines carried as *names*; personal marks and attribution arrive in ticket 05, media in ticket 04); the archive writer (records → zip, in-memory); positive format detection via the manifest with the extension as a human hint; and the Norish parser as format #6 in the shared loop, inheriting its semantics unchanged.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] Manifest shape defined: format identifier, `formatVersion: 1`, export timestamp, exporter block, recipe count
- [x] `recipe.json` shape defined as a superset of the canonical insert shape, with cuisines as names instead of instance-local identifiers
- [x] Archive writer produces a zip with root manifest and one folder per recipe keyed by recipe id
- [x] Format detection positively identifies a Recipe Archive by its manifest, not its extension; the import UI's file picker accepts the `.norishrecipes` extension
- [x] The Norish parser yields canonical insert shapes into the existing import loop unchanged: URL-or-name match within household scope, overwrite on match, freshly minted ids otherwise; archive ids are folder keys only
- [x] Cuisine names resolve case-insensitively against the target vocabulary; unmatched names are dropped — never created, never demoted to Tags
- [x] Writer and parser unit tests in the existing archive-test style (in-memory zips, mocked persistence)
- [x] The centerpiece round-trip test passes: records → writer → zip → parser → insert shapes, asserting losslessness plus the deliberate losses (unmatched cuisines dropped, ids re-minted, ownership flattened to the importer)
- [x] A fixture archive imports end-to-end through the existing import UI on a dev instance
