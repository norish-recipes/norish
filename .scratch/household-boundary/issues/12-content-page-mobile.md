# 12: Content page on mobile

**What to build:** A Content row in mobile Settings opening a screen with tabs for Tags, Cuisines, Categories and Ingredients, built from the canvas (ticket 10). It has the same actions and rights as web, including the full Ingredients management that mobile lacks today. Admin settings stay web-only. See the spec, "The Content page".

**Blocked by:** 05, 07, 10

**Status:** ready-for-agent

- [ ] **The Settings row:** a Content row in `apps/mobile/src/features/settings/screens/settings-screen.tsx`, with routes under `apps/mobile/src/app/settings/`.
- [ ] **Tags, Cuisines and Categories tabs:** list, search, counts, "unused" filter, Add, rename or merge, and delete with a count confirmation. Instance entries are read-only for members and editable by admins, with built-ins fixed. Shared logic lives in `packages/shared-react`, not copied per app.
- [ ] **Ingredients tab:**
  - search and filters;
  - the food panel: name, spellings, parent, icon upload or generate, keep distinct, merge, delete and nutrition correction;
  - flags and Changed by AI;
  - Add.
- [ ] **Copy** in all locales.
- [ ] **Device check** on the iOS simulator through the device tools: add, merge and delete a Tag; edit a food's parent and icon.
