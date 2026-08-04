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

**The fault is general.** Verified in headless Chromium at 390x844 against a throwaway page
(`app/(auth)/login/panel-overlays`, since deleted — the `login` prefix is excluded from the
proxy matcher, so it needed no sign-in) holding a Dropdown, a Select and a DatePicker inside
one open Panel, each rendered twice: without a portal container and with one.

Measured `getComputedStyle`, then clicked and recorded what the handler received:

| overlay | `body` | popover | click |
| --- | --- | --- | --- |
| Dropdown menu, bare | `none` | `none` | nothing lands |
| Dropdown menu, wired | `none` | `auto` | `Dinner` |
| Select, bare | `none` | `none` | nothing lands |
| Select, wired | `none` | `auto` | `Lunch` |
| DatePicker calendar, bare | `none` | `none` | nothing lands |
| DatePicker calendar, wired | `none` | `auto` | `2026-08-15` |

So the guess in the ticket — that the library might set pointer events on its own popovers —
is wrong, and it is wrong for a structural reason: `Select.Popover`, `Dropdown.Popover` and
`DatePicker.Popover` are all the same `react-aria-components` `Popover`, and nothing in the
shipped HeroUI stylesheet sets `pointer-events: auto` on any of them. The only overlay
surfaces that do are toast, modal, drawer and alert-dialog. Only the menu was *reported*
because it is the only one on a phone-first path.

Wired accordingly — every overlay that actually sits inside a Panel today:

- `components/shared/slot-dropdown.tsx` (already)
- `components/Panel/consumers/edit-planned-recipe-panel.tsx` — date picker and slot select
- `components/Panel/consumers/edit-note-panel.tsx` — slot select
- `components/groceries/store-selector.tsx` — rendered in the add- and edit-grocery panels
- `app/(app)/recipes/[id]/components/recipe-share-panel.tsx` — expiry select

Nothing else was wired: `recurrence-panel` renders its calendar inline, and every other
popover in the app (navbar menu, grocery rows, calendar day cards, admin forms) is never
inside a Panel. The `<DatePicker />` in `edit-note-panel` has no children at all, so HeroUI
renders no trigger and no popover for it — pre-existing, and left alone.

Two shape notes for whoever reads the diff:

- The container is read through a new `usePanelPortalContainer()` in `Panel.tsx`, which
  carries the `UNSTABLE_portalContainer` note once instead of five times.
- Three call sites had their overlay JSX extracted into a child component. That is not
  tidying: the hook has to run *under* the Panel, and these panels render `<Panel>` in the
  same component that held the overlay, where the context is not yet in scope.

The test seam is raised, as the ticket asked for the general case:
`__tests__/components/shared/slot-dropdown.test.tsx` now renders the real HeroUI Dropdown
inside the real Panel and asserts the menu is a descendant of the Panel's content. The old
version captured the container prop from a mocked `Dropdown.Popover` and would have passed
just as happily if the prop stopped being honoured.
