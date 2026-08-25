# 05 — Open a cookbook and browse it

**What to build:** A cookbook gets its own page at its own address, so it can be linked, bookmarked and reached with the back button. It shows its recipes through the same grid the Library uses, in the reader's stored grid or list layout, honouring their sort, their search and the Filters panel — a large cookbook stays usable. Its title carries the same rename and delete menu the card carries, and a recipe can be taken out from here. Cookbook cards throughout the app now show a cover drawn from their members' pictures and a count of what the reader can see.

**Blocked by:** 04 — a cookbook page needs members to show.

**Status:** ready-for-agent

- [ ] A cookbook has its own route, so it is linkable, bookmarkable and correct under the back button
- [ ] Members render through the existing grid in the reader's stored view mode, with scroll restoration working as it does on the Library
- [ ] Members are ordered by the reader's own sort, and the Filters panel and search apply within the cookbook
- [ ] The page's title carries the same Rename and Delete menu as the card, and delete confirms by name
- [ ] A recipe can be removed from the cookbook from this page
- [ ] A cookbook card's cover is a mosaic of its first few members' primary images, resolved gallery-first, and is stable between reads
- [ ] Fewer members than tiles fills what exists; no members renders the plain tile
- [ ] The member count reflects what the reader can see, so two readers may honestly see different counts for the same cookbook
- [ ] An empty cookbook explains itself rather than rendering a blank page
- [ ] Database seam test: the member query applies the same view policy condition the recipe list applies, so count and list agree by construction
- [ ] All new strings exist in 14 locales; `pnpm i18n:check` passes
