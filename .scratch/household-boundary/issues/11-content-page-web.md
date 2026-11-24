# 11: Content page on web

**What to build:** The Content tab in web Settings, replacing the Ingredients tab, built from the canvas (ticket 10). It has tabs for Tags, Cuisines, Categories and Ingredients, each with search, usage counts, an "unused" filter, Add, rename or merge, and delete. Instance Cuisines move here from Admin › AI. See the spec, "The Content page".

**Blocked by:** 05, 07, 10

**Status:** ready-for-agent

- [ ] **The tab:** `SETTINGS_TABS` (`apps/web/components/settings/settings-tab.ts`) gets `content` in place of `ingredients`, and the old route redirects.
- [ ] **Tags, Cuisines and Categories tabs** run on ticket 05's procedures:
  - the household's entries plus the instance's;
  - search on the folded name;
  - the count of the household's recipes carrying each, and an "unused" filter;
  - Add, rename (onto an existing name merges, after a confirmation), and delete with a count confirmation;
  - instance entries read-only for members and editable by admins, with built-ins fixed.
- [ ] **Ingredients tab:** today's `apps/web/features/ingredients/ingredients-screen.tsx` and its panel, plus Add (ticket 07).
- [ ] **Admin › AI** loses `cuisine-vocabulary-form.tsx`. Cuisine strategy selects stay.
- [ ] **Copy** in all locales.
- [ ] **E2E:**
  - a member adds, renames onto another (merge) and deletes a Tag;
  - a member sees an instance Cuisine read-only, and an admin edits it;
  - household B never sees household A's entries.
- [ ] **Docs screenshots** this outdates are listed for Mike.
