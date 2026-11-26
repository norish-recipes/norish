# 13: Docs, release notes and upgrade notes

**What to build:** The docs pages for households, permissions and the Content page, an Upgrade note, and the 0.28.0-beta release notes. Docs are written by Terra, following the docs rules in its brief. See `docs/agents/feature-docs.md`.

**Blocked by:** 01–09, 11, 12, 14

**Status:** ready-for-agent

- [x] **Release notes** (`apps/docs/docs/release-notes/0.28.0-beta.md`) in plain product language:
  - households are the boundary;
  - the one Permission Policy and its Everyone and Household levels, with the admin no longer bypassing it;
  - household lists and the Content page on web and mobile;
  - leaving takes your recipes;
  - deleting an account erases them.
- [x] **Upgrade notes:**
  - a stored `owner` level becomes Household;
  - the ingredient policy is gone;
  - shared tags, categories and foods are split per household;
  - orphans go to the server owner's household;
  - an admin no longer sees other households' recipes.
- [x] **Docs pages:** the permissions or configuration page and the settings pages in `apps/docs/docs/` describe the policy, the Content page and households. `apps/docs/versioned_docs/` and older release notes stay untouched.
- [x] **Screenshots** outdated by tickets 11 and 12 are listed for Mike.

## Comments

Documented household ownership, permissions, the Content page and upgrade changes. Updated the relevant ADRs and contributor guidance.
Screenshots need manual retakes; no images were changed.

Existing screenshots to retake:

- `apps/docs/static/img/screenshots/admin-cuisines.png`: Updated admin cuisines.
- `apps/docs/static/img/screenshots/ingredients-list.png`: Updated ingredients list.
- `apps/docs/static/img/screenshots/ingredients-page.png`: Updated ingredients page.
- `apps/docs/static/img/screenshots/ingredients-changed-by-ai.png`: Updated ingredients changed by ai.
- `apps/docs/static/img/screenshots/ingredients-clean-names.png`: Updated ingredients clean names.
- `apps/docs/static/img/screenshots/ingredients-delete.png`: Updated ingredients delete.
- `apps/docs/static/img/screenshots/ingredients-nutrition-correction.png`: Updated ingredients nutrition correction.
- `apps/docs/static/img/screenshots/ingredients-panel-nutrition.png`: Updated ingredients panel nutrition.
- `apps/docs/static/img/screenshots/settings-after-planning.png`: Updated settings after planning.
- `apps/docs/static/img/screenshots/settings-change-password.png`: Updated settings change password.
- `apps/docs/static/img/screenshots/hidden-items-settings.png`: Updated hidden items settings.
- `apps/docs/static/img/screenshots/admin-prompts.png`: Updated admin prompts.
- `apps/docs/static/img/screenshots/admin-decision-model.png`: Updated admin decision model.
- `apps/docs/static/img/screenshots/admin-image-generation.png`: Updated admin image generation.
- `apps/docs/static/img/screenshots/admin-clean-up-catalogue.png`: Updated admin clean up catalogue.
- `apps/docs/static/img/screenshots/admin-fill-gaps.png`: Updated admin fill gaps.
- `apps/docs/static/img/screenshots/admin-job-details.png`: Updated admin job details.
- `apps/docs/static/img/screenshots/admin-page-renderers.png`: Updated admin page renderers.
- `apps/docs/static/img/screenshots/recipe-archive-admin-export.png`: Updated recipe archive admin export.
- `apps/docs/static/img/screenshots/mobile-settings.png`: Settings with the Content entry.
- `apps/docs/static/img/screenshots/recipe-form-add-category.png`: Recipe category picker.

New screenshots needed:

- Web: Content page with its four tabs and household and server entries.
- Web: An entry showing Used by and the rename, merge and delete actions.
- Mobile: Content page with its four tabs and household and server entries.
- Mobile: Long-press menu and an entry showing Used by.
