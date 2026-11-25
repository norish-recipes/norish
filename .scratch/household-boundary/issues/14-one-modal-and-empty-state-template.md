# 14: One modal template and one empty-state template

**What to build:** Every web modal goes through one template, and every empty list on web and mobile goes through one empty-state template. Both are title and content only: no subtitle or description line. The Content page (tickets 11 and 12) is built on them. Canvas: https://claude.ai/artifact/PXzHGxBxCU4MmwF8scvixz#page-816ab097d43b (the delete confirm, the Add panels, and "Tags, none yet" on both platforms).

**Blocked by:** none

**Status:** ready-for-agent

- [ ] **The modal template** (web): a title, the content, and a footer whose way out or destructive action (Cancel, Delete, Remove) sits on the left and whose primary sits on the right, through `ActionButtonGroup`'s `start`. `components/shared/confirm-modal.tsx` becomes it, and every other `Modal.Footer` moves onto it:
  - `components/imports/import-from-image-modal.tsx`, `import-from-paste-modal.tsx`, `import-recipe-modal.tsx`;
  - `components/ingredients/delete-ingredient-modal.tsx`, `junk-spelling-modal.tsx`;
  - `components/shared/delete-recipe-modal.tsx`;
  - `features/account/components/api-token-card.tsx`, `change-password-modal.tsx`;
  - `features/admin/components/jobs/job-detail-modal.tsx`;
  - `features/calendar/components/caldav/caldav-config-edit-modal.tsx`;
  - `features/groceries/components/stores/delete-store-modal.tsx`;
  - `features/library/components/panels/cookbook-panels.tsx`.
- [ ] **Panel footers** follow the same split: Cancel joins Delete on the left (`components/ingredients/ingredient-relocation.tsx`, `features/groceries/components/stores/store-editor-panel.tsx`, `features/admin/components/ai/cuisine-vocabulary-form.tsx`).
- [ ] **The empty-state template:** mobile's `EmptyCard` (`apps/mobile/src/components/empty-card.tsx`): the area's icon in muted ink on the left, the title on the right, and at most one action under them. No tinted circle on either app: the `GROUND` tones go.
  - Mobile: every `EmptyCard` and `NoResultsCard` user follows (library, cookbooks, groceries, pantry, manage stores, search, the Settings connection lists and failed loads). Two sheets still draw a centred muted line and move onto it: `features/groceries/screens/pantry-add-screen.tsx` (no results) and `features/recipes/screens/add-to-cookbook-screen.tsx` (no editable cookbook).
  - Mobile drops the `description` prop and its copy (`groceries.mobile.emptyHint`, `recipes.empty.descriptionMobile`, `recipes.empty.noResultsHint` as a description).
  - Web gets the same icon and title, drawn flat as the card's only row: the card drops its own title and header, and its Add sits at the right end of the row (no second box, no full-width button). Every empty list moves onto it: today a centred muted line (`features/groceries/pantry-screen.tsx`, `features/ingredients/ingredients-screen.tsx`, `features/library/components/grid/no-recipe-results.tsx`, `features/admin/components/ai/model-listing-empty-state.tsx`, the share links, API keys and site tokens cards). The full candidate list is every web file reading an `empty…`/`noResults` message: `Panel/consumers/mini-cookbooks.tsx`, `ingredients/ingredient-nutrition.tsx`, `ingredients/ingredient-panel.tsx`, `navbar/offline-status/offline-status-modal.tsx`, `settings/share-links-table-card.tsx`, `account/components/api-token-card.tsx`, `account/components/site-auth-tokens-card.tsx`, `admin/components/ai/cuisine-vocabulary-form.tsx`, `admin/components/ai/model-listing-empty-state.tsx`, `admin/components/jobs/job-queue-card.tsx`, `admin/components/users/users-card.tsx`, `calendar/components/caldav/caldav-sync-status-card.tsx`, `groceries/pantry-screen.tsx`, `ingredients/components/changed-by-ai-panel.tsx`, `ingredients/ingredients-screen.tsx`, `library/components/grid/cookbook-members.tsx`, `library/components/grid/no-recipe-results.tsx`, `library/components/panels/cookbook-panels.tsx`, `recipes/components/page/recipe-share-panel.tsx`; each one that shows an empty list moves, and one that only uses the word inline (a field placeholder, a status line) stays.
- [ ] **Copy:** unused description keys are removed in every locale.
- [ ] **Tests:** the existing modal and empty-state tests keep passing on the templates; one test pins the footer order (left action, then primary).
