# 06: Completions in the web add-grocery panel

**What to build:** Ghost text and up to three Completion chips under the name field of `apps/web/features/groceries/components/panels/add-grocery-panel.tsx`, as picked on the canvas. See the spec, "Candidates and order" and "Keyboard (web)".

**Blocked by:** 01, 03, 04

**Status:** ready-for-agent

- [ ] **Candidates:** the household's grocery names (ticket 04) for the name part of the text; "2 mi" completes to "2 milk".
- [ ] **Keys:** as ticket 05. Enter adds exactly what was typed.
- [ ] **Fill only:** a Completion fills the name; amount, unit and store are not copied from old rows.
- [ ] **Tests:** jsdom for keys and the amount; E2E: add "milk", clear done, type "mi", Tab, Enter adds "milk".
