# 05: Completions in the web Library search

**What to build:** Ghost text and up to three Completions in the web Library search (`apps/web/features/library/components/header/search-input.tsx`), as picked on the canvas. See the spec, "Candidates and order" and "Keyboard (web)".

**Blocked by:** 01, 03

**Status:** ready-for-agent

- [ ] **Candidates:** top-result titles from `useLibraryList`, then ingredient, tag and category names from `useLibrarySuggestions`, through the match rule.
- [ ] **Keys:** Tab or → at the end accepts the ghost text; Tab without it moves focus; Enter never takes the ghost text.
- [ ] **Fill only:** accepting or clicking a Completion sets the text and the search runs as if typed. An ingredient or tag stays text, never a filter chip.
- [ ] **Stale:** a Completion shows only while it matches the field's current text.
- [ ] **Tests:** jsdom for keys and stale answers; E2E: type "tik", Tab, the field reads the title and the results match.
