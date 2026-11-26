# 14: One modal template and one empty-state template

**What to build:** Every web modal goes through one template, and every empty list on web and mobile goes through one empty-state template. Both are title and content only: no subtitle or description line. The Content page (tickets 11 and 12) is built on them. Canvas: https://claude.ai/artifact/PXzHGxBxCU4MmwF8scvixz#page-816ab097d43b (the delete confirm, the Add panels, and "Tags, none yet" on both platforms).

**Blocked by:** none

**Status:** done

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


### Review round 1

- 1 fixed (6e741e094): one `variant` prop on `EmptyState`; `EmptyStateCard` and the `className` escape hatch are gone, no caller passes spacing.
- 2 fixed: `LibraryEmpty` (recipes and cookbooks lens) and `GroceryListEmpty` replace the two pairs.
- 3 fixed: store manager, cookbook add-recipes and mini-cookbooks use the row; `createStoreHint` removed from every locale.
- 4 fixed: data table, CalDAV sync and users use the cell variant; the title is foreground ink everywhere.
- 5 fixed: the page variant's title is an `h2`; row and cell keep a paragraph; the icon stays `aria-hidden`.
- 6 not changed: `SettingsCard.empty` has a caller, `share-links-table-card.tsx`.
- 7 fixed (b5d7e63db): `EmptyCard` takes `action` and draws it as a HeroUI Native `Button` (accent-soft fill, accent text, 44 high, pill); `NoResultsCard` removed. `p-4.5` replaces `p-[18px]`; `bg-sand` is the theme token for sheet cards, kept, chosen through `useOnSheet` so callers pass no ground. Callers still pass `mx-5`/`mt-4` positions on mobile, not changed (the parent layout owns them and no simulator ran).
- 8 fixed (a2ef02abe): job detail has no close X; Close and Remove or Cancel job left, Retry right; confirm state has Cancel left, Remove right and the warning in the body.
- 9 fixed (a2ef02abe): Cancel and Remove left, `junkMark` right, through `ConfirmModal`'s `start`.
- 10 fixed (25bc28be3): Reset in `start`, Apply right.
- 11 not changed: the generated-key modal shows the key once, is not dismissible and has only Done.
- 12 fixed (a2ef02abe): `ModalFooter` has only `start`; `CancelButton` fills it. `ConfirmModal` lost `size` (the import modals take the default width), `headerClassName` and `bodyClassName`, and gained `danger` and `start`.
- 13 fixed (a2ef02abe): the test asserts Cancel and Remove in the start slot, the primary alone in the end slot, and no description; the templates use no physical-side classes.

Empty-state variants: `page` is a card under `px-4 py-20`, `max-w-xl`, with an `h2` title; `row` is flat with no padding inside a card, panel or sheet body; `cell` is flat under `px-4 py-6` inside a table or list body.

Kept as built: Cancel without a close X on the import, CalDAV and junk-spelling modals; no Add or hint in the grocery, pantry, ingredients and library empties; the API keys and site tokens cards' header and form; the start slot shrinking to an icon when narrow.

### Review round 2

- 1 fixed: mobile `EmptyCard` takes `placement`, no `className`. `screen` = `mx-5 mt-4` (library, cookbooks lens and cookbook, groceries, pantry notes, search no-results/offline/failed); `section` = `mt-4` (Settings `connection-list`, `failed-load`); `sheet` = no margin (manage stores, pantry add, add to cookbook). Cookbook's `pt-[22px]` wrapper is gone. Pantry add uses the sheet's default inset: its header, `CardSlice`, `ShowMore` and skeleton no longer add their own 20 on a sheet.
- 2 fixed: ingredients' empty is the `row` variant in its card; pantry's two empties are the `cell` variant on a plain surface under the field (no card, so `row` would float). Every other `page` use is a screen's whole content.
- 3 fixed: `ModalFrame` (confirm-modal.tsx) has `wide`: `max-w-3xl` and `max-h-[85vh]`; job detail uses it with no size class; the import modals stay default.
- 4 fixed: `Modal.Heading` in `ConfirmModal` and the job detail header; the footer test finds `getByRole("dialog", { name })`. Not done: other modals that mount their own `Modal.Header` (delete store/ingredient, change password, CalDAV, sign-out, API key, offline status) still have no heading.
- 5 fixed: the refusal line is the `cell` variant with an alert icon, so both lines of the popover share one inset.
- Tests: one padding assertion per web variant and per mobile placement.
- Follow-up: every modal takes its title from `ModalTitle` (a `Modal.Heading`, so the dialog has a name) and, bar CalDAV edit (own container: `scroll="inside"`, `lg`), its frame from `ModalFrame`; sign-out is a `ConfirmModal`; the model-listing spinner sits in `CellSlot`. `recipe-print` keeps its own header (a print toolbar with actions).
