# 18 — The membership panel commits on Save

**What to build:** It was the only panel in the app that wrote as you tapped, so closing it meant "keep it" rather than "never mind" and a mis-tap had no way back except tapping the same toggle again. Amends `04`.

**Status:** ready-for-human

- [x] Toggling a cookbook stages the change; nothing is written until Save
- [x] Closing the panel discards every staged change
- [x] The "new cookbook with this recipe" row stages a pending row, visible immediately, created on Save — which is what makes `12` observable rather than only correct
- [x] A title typed but never added creates nothing: adding the row is the confirmation step, and Save stays disabled without one
- [x] Save is disabled until something has actually changed
- [x] The list stays a plain list rather than a menu, so the documented focus-steal race is not reintroduced
- [x] Unit tests for staging, for a toggle tapped back to where it started, and for the pending row
- [x] Browser E2E: staged-then-saved filing, and closing without saving changing nothing
