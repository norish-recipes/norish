# 24 — A cookbook page keeps up, and the add panel offers what can be added

**What to build:** Two defects in the bulk-add work from `22`.

**Status:** ready-for-human

- [x] Adding recipes from a cookbook's own page left that page listing what it held a moment earlier: a membership change invalidated the cookbook row and the Library lists but not the member list the page is reading, which is keyed by whatever sort, search and filters the reader had on
- [x] `invalidateCookbook` now means everything that one cookbook answers for — its row, its member list, and which recipes it holds — matched by path and read back out of the key rather than guessed
- [x] The add panel leaves out recipes the cookbook already holds: a list titled "Add recipes" should offer what can be added
- [x] That needs the member ids for the whole cookbook rather than a page of it, since the reader may search anywhere in a long list, so `cookbooks.memberIds` is a new query — ids only, under the same view rule browsing the cookbook takes
- [x] It joins the Warm Set beside the cookbook's other reads, or Offline the panel would offer to add every member back
- [x] Router seam tests: who may read the member ids, and that a reader who may not see the cookbook is refused
