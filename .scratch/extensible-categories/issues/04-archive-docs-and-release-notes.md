# 04: Archives carry Categories, docs and release notes

**What to build:** Exporting a recipe carrying Drinks to a Norish Recipe Archive and importing it on another instance gives a recipe carrying Drinks, with Drinks now in the importer's list. The docs and release notes say households can add Categories. See `.scratch/extensible-categories/spec.md`, "Imports".

**Blocked by:** 01, 02, 03

**Status:** done (#442 closes when it ships)

- [x] `norish-writer.ts` writes Category names, and the archive reader creates them as they are under the naming rules. A built-in synonym still resolves to the built-in. The field stays within `formatVersion: 1`.
- [x] A round-trip test beside the existing archive tests.
- [x] Release notes: a `###` under Features in `apps/docs/docs/release-notes/0.27.0-beta.md`, closing #442.
- [x] `apps/docs/docs/recipes/enrichment.md` and `configuration/ai-provider.md`: categorising picks from the household's Categories. Add a short paragraph with a screenshot of the add control on the recipe docs page.
- [ ] Close #442 when it ships.
