# 13: Docs, release notes and upgrade notes

**What to build:** The docs pages for households, permissions and the Content page, an Upgrade note, and the 0.28.0-beta release notes. Docs are written by Terra, following the docs rules in its brief. See `docs/agents/feature-docs.md`.

**Blocked by:** 01–09, 11, 12

**Status:** ready-for-agent

- [ ] **Release notes** (`apps/docs/docs/release-notes/0.28.0-beta.md`) in plain product language:
  - households are the boundary;
  - the one Permission Policy and its Everyone and Household levels, with the admin no longer bypassing it;
  - household lists and the Content page on web and mobile;
  - leaving takes your recipes;
  - deleting an account erases them.
- [ ] **Upgrade notes:**
  - a stored `owner` level becomes Household;
  - the ingredient policy is gone;
  - shared tags, categories and foods are split per household;
  - orphans go to the server owner's household;
  - an admin no longer sees other households' recipes.
- [ ] **Docs pages:** the permissions or configuration page and the settings pages in `apps/docs/docs/` describe the policy, the Content page and households. `apps/docs/versioned_docs/` and older release notes stay untouched.
- [ ] **Screenshots** outdated by tickets 11 and 12 are listed for Mike.
