# 41: Tab-root headers and the avatar menu

**What to build:** The approved canvas of ticket 40 in code. See spec Part 7 ("Tab roots").

**Blocked by:** 40 (approved by Mike)

**Status:** ready

- [ ] Native large titles on Recipes, Groceries, Pantry and Calendar; `TitleRow` and the `top: "soft"` edge effect go; no title under a blur at rest. The accessory still minimises on scroll on every tab.
- [ ] Controls placed as the canvas's `place: header` boards draw them (Mike's pick). Scrolled, the bar shows no inline title; header items are translucent glass; Calendar loses its sync button.
- [ ] The avatar (top right on all four) opens a native menu: status line (always: "Live", or Offline), Theme, Language, All settings, Sign out. A warning dot when Offline; VoiceOver "‹name›, Offline"; "Offline · N changes waiting" with Queued changes.
- [ ] The calendar's Offline pill goes; the `calendar-offline` Maestro flow checks the screen instead.
- [ ] Gates green; checked on the device in both themes.
