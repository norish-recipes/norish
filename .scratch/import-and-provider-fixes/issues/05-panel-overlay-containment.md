# 05 — Panel overlays render inside the Panel

**What to build:** Adding a recipe to the calendar from its own page works on a phone. Today
the slot menu opens over the panel and ignores every tap, because the drawer holds the rest of
the page inert and an overlay portalled to the document body lands outside the drawer — it
renders, but no click reaches it.

Closes [#511](https://github.com/norish-recipes/norish/issues/511).

**Blocked by:** 01.

**Spec:** `.scratch/import-and-provider-fixes/spec.md`

**Status:** ready-for-agent

The Panel already exposes its own element as a portal container in the uncommitted tree, and
the slot menu already uses it. What is undecided is how far the fault reaches.

- [ ] **Verification first.** With the app running on a phone-sized viewport, confirm whether a
      select, a date picker and a calendar opened inside a Panel respond to input. They are the
      same kind of overlay as the slot menu and are unwired. They may well be fine — if the
      library sets pointer events on its own popovers where the menu does not, that alone
      explains why only the menu was reported. Record the finding in this ticket's comments
      either way; the finding is part of the deliverable.
- [ ] Adding a recipe to the calendar from its detail page works on a phone-sized viewport.
- [ ] Overlays that verification showed to be affected render inside the Panel. Ones that are
      not affected are left alone — do not wire on suspicion.
- [ ] If the fault proved general, the test seam is raised: assert the overlay renders inside
      the Panel's content rather than capturing the container prop from a mock. The existing
      test pins the wiring, not the behaviour, and would not have caught the original bug.
- [ ] The escape hatch used to redirect the portal is the deprecated-but-supported one; its
      replacement ships in a package this app does not share a module instance with. Leave the
      note explaining that, so nobody "modernises" it into a broken state.
- [ ] The GitHub issue is closed with a comment recording how far the fault actually reached.

## Comments
