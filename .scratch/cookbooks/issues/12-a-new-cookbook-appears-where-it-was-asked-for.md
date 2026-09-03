# 12 — A new cookbook appears in the panel that made it

**What to build:** Making a cookbook from a recipe created it and filed the recipe into it, and the membership panel never showed it. `cookbooks.editable` is a cookbook list and was missing from the cookbook cache helpers, so `invalidate` and `setAllCookbooksData` reached every cached list except the one the reader was looking at. Fixes a defect in `04`.

**Status:** ready-for-human

- [x] `invalidate` covers the editable list
- [x] `setAllCookbooksData` patches it too — it is a flat array, so it is wrapped as one page for the same updater and read back out
- [x] A rename, a delete and a membership count change therefore all reach the membership panel as well
- [x] The wrap-and-unwrap is a pure helper beside the Library's own, so a create, a rename and a delete reaching the panel are each assertable
- [x] Unit tests: a cookbook asked for is visible in the panel before it exists on the server, and a create, a rename and a delete each reach the panel's list
