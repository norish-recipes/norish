# 05: Settings, cookbook and auth skeletons, and no spinners

**What to build:** Every remaining page shows one Skeleton in its own shape, and no page shows a full-page spinner.

- **Settings:** one skeleton from `loading.tsx` until the tab's data arrives. The Suspense, `dynamic()` and `isLoading` fallbacks draw that same skeleton or go. The real tab bar (the server knows whether the reader gets the admin tab) and per-tab card headers with their icons and titles.
- **Cookbook:** a skeleton of the cookbook page in place of the spinner, and a `loading.tsx`.
- **Login and signup:** the real auth frame (wordmark, language selector, card width and shadow) with the fields as placeholders. Signup gets a `loading.tsx`.
- **Auth-error and the prompts form:** a skeleton of their own in place of the spinner.
- Real words: headings and card titles render through translations.

See `.scratch/skeletons-and-page-loads/spec.md`, Skeletons.

**Blocked by:** None. The view-transitions work in the checkout touches the cookbook page and the auth frame and is committed first.

**Status:** done

- [x] Each skeleton matches its page, checked side by side in a browser.
- [x] Settings shows one skeleton across a hard load and a tab switch.
- [x] No page-level `Spinner` remains (the library grid's load-more spinner is not a page load and stays).
- [x] Existing tests that assert skeleton markup are updated.
- [x] Release notes, Fixes and Improvements: "Pages show a placeholder in their real shape while loading, and phones get the phone calendar from the start."

**Done 2026-10-15** (`bc0a7e3f8`, `bf75d0b5d`): settings draw one `SettingsTabs` frame (real tab bar) with `SettingsTabSkeleton` per tab from `loading.tsx`, `dynamic()` and each tab's `isLoading`; household and CalDAV draw the reader's own cards, from a `readSettingsShape` the route's skeleton and the page share (with or without a household, household admin, CalDAV set up and syncing); only the household's name stays grey. The Ingredients tab keeps grey rows under its real search field until its first page arrives. The prompts-form spinner was dead (its card renders after the same `isLoading`), so it was deleted. Auth-error keeps its Suspense: the page is prerendered, so its fallback is now a skeleton. The offline shell's cookbook spinner became the cookbook skeleton too.
