# 02: A household adds a Category from the recipe form

**What to build:** In the recipe form's category chips, a person types "Drinks" and saves. The recipe carries Drinks, and every member of their household now sees a Drinks chip in the form and the filters panel. Filtering by it shows the recipes that carry it. A user in another household never sees it offered. See `.scratch/extensible-categories/spec.md`, "The model".

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The recipe form's chip row ends with an inline add, using the same HeroUI input pattern as the tag field. A name that resolves to an existing chip (a built-in synonym, or a different case) selects that chip instead of adding one.
- [ ] The filters panel and the filter URL contract accept any name in the household's list. The quick-filter presets and the random picker's `SLOT_TO_CATEGORY` stay built-in only.
- [ ] The read-only recipe view, mobile recipe header, cooking-mode header and public share view show a non-built-in Category verbatim.
- [ ] Copy for the add control in all 18 locales (`pnpm i18n:check`).
- [ ] E2E (two households): household A adds Drinks and filters by it. Household B's form and filters don't offer it, even under the "everyone" view policy, but B viewing A's recipe sees Drinks on it.
