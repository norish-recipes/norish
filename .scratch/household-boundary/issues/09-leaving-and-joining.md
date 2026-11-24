# 09: Leaving takes your recipes, joining merges a household of one

**What to build:**

- **Leaving or being removed:** the person's recipes and cookbooks move to their new household of one, with copies of the household names and foods those recipes use.
- **Joining from a household of one:** it merges into the joined household.

See the spec, "Membership changes".

**Blocked by:** 03, 05, 07

**Status:** ready-for-agent

- [ ] **Leave and remove** (one shared path) move the person's recipes and cookbooks to the new household, with their images, videos and share links. Then:
  - their Tags, Cuisines and Categories are matched on the folded name in the new household and created where missing;
  - each household food their lines use is copied into the new household with its name, the spellings those lines use, its icon and any seed parent, and the lines are re-pointed at the copies;
  - nutrition corrections, Aisle Links and store links stay behind.
- [ ] **The leave and remove dialogs** (web and mobile) say what goes and what stays.
- [ ] **Joining as the last member of a household of one** merges it in:
  - recipes, cookbooks and every household row move to the joined household;
  - Tags, Cuisines and Categories with the same folded name join the household's entry;
  - a spelling both catalogues hold merges the joiner's food into the household's, through the existing merge;
  - Pantry duplicates are dropped;
  - both sets of stores are kept;
  - the empty household is deleted.

  This lifts ticket 01's interim refusal. A member of a larger household leaves first, as today's flow does.

- [ ] **Old household's plan:** its entries for the moved recipes show only the title wherever it can no longer see them (ticket 03).
- [ ] **Each move is one transaction** followed by a Scope Change.
- [ ] **Tests:**
  - leaving under view Household: the leaver keeps their recipes with tags and foods intact, and the household no longer sees them;
  - joining merges "soja" and "ui" into the household's;
  - E2E for leave and join.
