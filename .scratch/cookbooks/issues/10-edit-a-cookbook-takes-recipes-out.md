# 10 — Edit a cookbook, not just rename it

**What to build:** Rename became **Edit cookbook**: the title and the list of what is in the cookbook in one panel, reached from its card in the Library and from the menu on its own page. Renaming and unfiling are the same decision often enough that splitting them across a panel and a separate page was the wrong seam. Supersedes the Rename-only menu item in `03`.

**Status:** ready-for-human

- [x] The panel shows the title and the cookbook's members together
- [x] Marking a recipe for removal is staged, not applied: it is un-marked, or the panel is closed and nothing happened
- [x] Save applies the rename and every staged removal together
- [x] Removing a recipe from a cookbook never writes the recipe (ADR-0027)
- [x] The same panel serves the Library card and the cookbook page, so the two cannot drift
- [x] Both staged edits commit through one seam: the panel takes the cookbook row and calls the mutations itself rather than handing the rename back out through a prop
- [x] A removal is written into every cached member list for that cookbook, whatever sort or filters keyed it, so an unfiling made Offline does not leave the row standing on the cookbook page
- [x] The panel is not mounted until it is first opened, because Library cards are virtualized and mounting it would fire its member read on every scroll-in
- [x] Browser E2E: the edit panel takes a recipe out, and stages it before Save
