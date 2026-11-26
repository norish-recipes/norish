# 14: One modal template and one empty-state template

**What to build:** Every web modal goes through one template, and every empty list on web and mobile goes through one empty-state template. Both are title and content only: no subtitle or description line. The Content page (tickets 11 and 12) is built on them. Canvas: https://claude.ai/artifact/PXzHGxBxCU4MmwF8scvixz#page-816ab097d43b (the delete confirm, the Add panels, and "Tags, none yet" on both platforms).

**Blocked by:** none

**Status:** ready-for-agent

- [x] **The modal template** (web): a title, the content, and a footer whose way out or destructive action (Cancel, Delete, Remove) sits on the left and whose primary sits on the right, through `ActionButtonGroup`'s `start`. `components/shared/confirm-modal.tsx` becomes it, and every other `Modal.Footer` moves onto it:
  - `components/imports/import-from-image-modal.tsx`, `import-from-paste-modal.tsx`, `import-recipe-modal.tsx`;
  - `components/ingredients/delete-ingredient-modal.tsx`, `junk-spelling-modal.tsx`;
  - `components/shared/delete-recipe-modal.tsx`;
  - `features/account/components/api-token-card.tsx`, `change-password-modal.tsx`;
  - `features/admin/components/jobs/job-detail-modal.tsx`;
  - `features/calendar/components/caldav/caldav-config-edit-modal.tsx`;
  - `features/groceries/components/stores/delete-store-modal.tsx`;
  - `features/library/components/panels/cookbook-panels.tsx`.
- [x] **Panel footers** follow the same split: Cancel joins Delete on the left (`components/ingredients/ingredient-relocation.tsx`, `features/groceries/components/stores/store-editor-panel.tsx`, `features/admin/components/ai/cuisine-vocabulary-form.tsx`).
- [x] **The empty-state template:** mobile's `EmptyCard` (`apps/mobile/src/components/empty-card.tsx`): the area's icon in muted ink on the left, the title on the right, and at most one action under them. No tinted circle on either app: the `GROUND` tones go.
  - Mobile: every `EmptyCard` and `NoResultsCard` user follows (library, cookbooks, groceries, pantry, manage stores, search, the Settings connection lists and failed loads). Two sheets still draw a centred muted line and move onto it: `features/groceries/screens/pantry-add-screen.tsx` (no results) and `features/recipes/screens/add-to-cookbook-screen.tsx` (no editable cookbook).
  - Mobile drops the `description` prop and its copy (`groceries.mobile.emptyHint`, `recipes.empty.descriptionMobile`, `recipes.empty.noResultsHint` as a description).
  - Web gets the same icon and title, drawn flat as the card's only row: the card drops its own title and header, and its Add sits at the right end of the row (no second box, no full-width button). Every empty list moves onto it: today a centred muted line (`features/groceries/pantry-screen.tsx`, `features/ingredients/ingredients-screen.tsx`, `features/library/components/grid/no-recipe-results.tsx`, `features/admin/components/ai/model-listing-empty-state.tsx`, the share links, API keys and site tokens cards). The full candidate list is every web file reading an `empty…`/`noResults` message: `Panel/consumers/mini-cookbooks.tsx`, `ingredients/ingredient-nutrition.tsx`, `ingredients/ingredient-panel.tsx`, `navbar/offline-status/offline-status-modal.tsx`, `settings/share-links-table-card.tsx`, `account/components/api-token-card.tsx`, `account/components/site-auth-tokens-card.tsx`, `admin/components/ai/cuisine-vocabulary-form.tsx`, `admin/components/ai/model-listing-empty-state.tsx`, `admin/components/jobs/job-queue-card.tsx`, `admin/components/users/users-card.tsx`, `calendar/components/caldav/caldav-sync-status-card.tsx`, `groceries/pantry-screen.tsx`, `ingredients/components/changed-by-ai-panel.tsx`, `ingredients/ingredients-screen.tsx`, `library/components/grid/cookbook-members.tsx`, `library/components/grid/no-recipe-results.tsx`, `library/components/panels/cookbook-panels.tsx`, `recipes/components/page/recipe-share-panel.tsx`; each one that shows an empty list moves, and one that only uses the word inline (a field placeholder, a status line) stays.
- [x] **Copy:** unused description keys are removed in every locale.
- [x] **Tests:** the existing modal and empty-state tests keep passing on the templates; one test pins the footer order (left action, then primary).

## Comments

- Modal template: `apps/web/components/shared/confirm-modal.tsx` exports `ConfirmModal` (title, content, Cancel left, primary right; takes `size`) and `ModalFooter` (`onCancel` or `start`, children at the right) for dialogs that mount their own content. Empty state: `apps/web/components/shared/empty-state.tsx` exports `EmptyState` (flat row, `action` at the end) and `EmptyStateCard`; `SettingsCard` takes `empty` and then drops its header. Mobile keeps `EmptyCard` and `NoResultsCard`, now icon in muted ink plus title plus one action. Tickets 11 and 12 build on these.
- Moved beyond the list: web grocery lists (`grocery-list.tsx`, `grocery-list-by-recipe.tsx`), `no-recipes-text.tsx`, `no-cookbooks-text.tsx` (glow card and description gone, `cssEmptyStateGlow` removed), the admin `DataTable`, users, job queue and CalDAV sync empties, the cookbook edit panel and changed-by-AI panel empties. `api-token-card` also had a second modal (the generated key), now on `ModalFooter`.
- Left alone: `offline-status-modal.tsx` (inline Cancel/Delete box, no `Modal.Footer`; its "empty" is a status line), `mini-cookbooks`, `ingredient-nutrition`, `ingredient-panel` (only the word in a prop name), `cuisine-vocabulary-form` (its footer is its `ConfirmModal`, so Cancel moved with the template), the model-listing refusal lines (errors). Other panel footers with `start` have no Cancel.
- Deviations: API keys and site tokens keep their header and form (the form is their Add); only the muted line became the row. Import, caldav and junk-spelling modals gained a Cancel, and the import modals lost their close X. No Add on the pantry, ingredients or library empties (their Add sits in the page header).
- Keys removed from every locale: `groceries.empty.description`, `groceries.mobile.emptyHint`, `recipes.empty.{description,noResultsHint,noCookbooksHint,descriptionMobile}`, `recipes.cookbooks.emptyHint`.
- Tests: `delete-recipe-modal.test.tsx` now renders the real modal (was a HeroUI mock, asserted only z-index); `no-results-card.test.tsx` (mobile) rewritten for the template (it asserted warning tones); `store-manager-panel.test.tsx` mock renders `start`. New: `confirm-modal.test.tsx` (footer order), `empty-state.test.tsx`, mobile template test. Maestro and E2E ids unchanged.
- Canvas read: `CtPage.dc.html` and `WcPage.dc.html` (row layout, 24px muted icon, Add at the end). Unused `use-warning-ink-color.ts` deleted. Not done: the mobile `Panel.dc.html` kit was not needed; mobile sheets use `bg-sand` cards.

