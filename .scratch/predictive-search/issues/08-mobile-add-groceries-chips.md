# 08: Completion chips in the mobile add-groceries sheet

**What to build:** Up to three chips under `NameField` in `apps/mobile/src/features/groceries/screens/add-groceries-screen.tsx`, as picked on the canvas. Tapping one fills the name. See the spec, "Candidates and order".

**Blocked by:** 01, 03, 04

**Status:** ready-for-agent

- [ ] **Candidates:** the household's grocery names (ticket 04), shown once a letter is typed and hidden when nothing matches. Works offline from the warm set.
- [ ] **Fill only:** the typed amount stays, nothing is added until the user adds it, the keyboard stays up.
- [ ] **Glass:** no solid strip behind the chips.
- [ ] **Tests:** a component test for the fill and the amount; device check on the iOS Simulator.
