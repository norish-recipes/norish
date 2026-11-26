# 13: Docs, release notes and upgrade notes

**What to build:** The docs pages for households, permissions and the Content page, an Upgrade note, and the 0.28.0-beta release notes. Docs are written by Terra, following the docs rules in its brief. See `docs/agents/feature-docs.md`.

**Blocked by:** 01–09, 11, 12, 14

**Status:** done

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

Existing screenshots to retake (under `apps/docs/static/img/screenshots/`):

- `admin-cuisines.png`: The admin card no longer has Cuisines. Not currently embedded.
- `recipe-archive-admin-export.png`: The admin card no longer has the server-wide export. Not currently embedded.
- `ingredients-list.png`: Ingredients are inside Content, with a picker and filters. Embedded in Manage ingredients.
- `ingredients-page.png`: Ingredients are inside Content, with a picker and filters. Not currently embedded.
- `ingredients-changed-by-ai.png`: The review panel layout changed. Not currently embedded.
- `ingredients-clean-names.png`: The Content page is behind the new dialog layout. Not currently embedded.
- `ingredients-delete.png`: The Content page is behind the new dialog layout. Not currently embedded.
- `ingredients-nutrition-correction.png`: The Content page is behind the nutrition panel. Embedded in Manage ingredients.
- `ingredients-panel-nutrition.png`: The Content page is behind the nutrition panel. Not currently embedded.
- `settings-change-password.png`: The modal has a new title layout and Cancel on the left. Embedded in Authentication.
- `admin-clean-up-catalogue.png`: The modal has a new title layout and Cancel on the left. Embedded in AI provider.
- `admin-fill-gaps.png`: The modal has a new title layout and Cancel on the left. Embedded in AI provider.
- `groceries-clear-list-confirm.png`: The modal has a new title layout and Cancel on the left. Not currently embedded.
- `groceries-clear-recipe-confirm.png`: The modal has a new title layout and Cancel on the left. Not currently embedded.
- `groceries-clear-store-confirm.png`: The modal has a new title layout and Cancel on the left. Not currently embedded.
- `admin-job-details.png`: The modal has a wide frame and no close X. Embedded in Admin settings.
- `admin-job-cancelled.png`: The modal has a wide frame and no close X. Embedded in Admin settings.
- `bulk-enrichment-image-count.png`: The warning layout changed. Embedded in AI provider.
- `offline-status-modal.png`: The frame and headings changed. Embedded in Offline.
- `groceries-aisles-editor.png`: Cancel moved left. Embedded in Shopping.
- `groceries-store-link.png`: Cancel moved left. Embedded in Shopping.
- `provenance-form.png`: The Cuisine picker changed. Embedded in Creating and editing recipes.
- `mobile-settings.png`: Settings has a Content row. Embedded in Use Norish on iPhone.
- `recipe-form-add-category.png`: The picker has an explicit Create action. Embedded in Creating and editing recipes.

New screenshots needed:

- Web Content page with the list picker and a list with household and server entries.
- Web entry panel with Used by, rename turning into Merge, and the delete confirmation.
- Mobile Content screen with its tabs.
- Mobile long-press menu and an entry sheet.
- Permission Policy setting for the households page.

Gatekeeper, 2026-11-26: closed at 099ee43e6 after one review round against the code (three wrong upgrade notes corrected, Households page added, Content page moved to the top level). Root format check and the docs build pass. Not ours and left alone: the docs format check fails on eight older release-note files; `docs/adr/index.html` (another session's file) does not yet show the reworded ADRs 0032, 0033 and 0041.
