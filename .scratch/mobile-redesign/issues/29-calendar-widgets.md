# 29: Calendar widgets

**What to build:** The small (current meal) and large (seven days) widgets, push only. See `.scratch/mobile-redesign/spec.md` Part 5 ("Widgets") and ticket 18's widget boards.

**Blocked by:** 22, 28

**Status:** open

- [x] An entry builder (pure, unit-tested): which meal per `nextMealSlot`, fall-forward within today, today plus 13 days, entries at midnight, 10:00 and 14:00.
- [x] The app pushes at launch, on foreground and on every calendar change it sees, realtime included; photos written to the shared folder.
- [x] Small and large widgets per the boards, with their tap targets; signed out and run-out lines; Sign-out clears them.
- [ ] Checked by hand on a device in light, dark, tinted and clear.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- 2026-11-15: `calendarWidgetTimelines` (`lib/calendar-widgets-state.ts`) builds both timelines from the current period to 14 days out, then "Open Norish"; the app reads 20 days so the large widget's last week is known, not assumed empty. `useCalendarWidgets` (signed-in shell) pushes on every change of that range (own writes and realtime merge into it), on foreground and on a new day; an identical push is skipped; `endSession` and the Sign in screen push "Open Norish to sign in" and delete every photo. Photos: at most 60, square-cropped to the widget's pixels with `expo-image-manipulator` (added; WidgetKit refuses images larger than the widget), removed once unshown; until one is on the device the small widget shows the meal as text (it still opens the recipe) and the large a fork tile, re-pushed when the download lands. Hidden Items and permissions: none hide the calendar; `listItems` already serves only what the member may see. A large day crowded past 10 lines ends on "+N more". Found on the simulator: `expo-widgets` refuses `null` in props (a missing photo is now left out) and reads 8-digit hex as RGBA, not ARGB as ticket 22 noted.
- Deviations from the boards: no Norish mark on the message cards (a widget can only draw an SF Symbol or a file, and a recoloured brand file per look is more than this ticket); the gallery name and description ("Next meal", "This week") are English only, as `expo-widgets` takes them from app.json.
- Simulator (iPhone 18 Pro, iOS 27.2, own server :3400, throwaway Postgres and Valkey; Debug, then Release for cold starts): small with a photo (Steak bowls), a note (Pizza night), "Nothing planned" pushed after a remove in the app; large with seven days, today ringed, thumbnails; a plan made in the app showed at once; a housemate's plan over the API stayed off the widget while Norish was in the background and showed on foreground, and one made with the app open arrived by realtime; every tap (recipe line, note, day label, empty day, header, small widget) opened the right place, warm and from a cold start, and signed out landed on Sign in; Sign-out left "Open Norish to sign in" on both and no photos; light, dark, tinted and clear all render (tinted/clear tiles fixed to 14%). Live Activity and the Share Extension still worked in the same build. Not seen: a roll at 10:00, 14:00 or midnight (the simulator clock cannot be set; the stored timeline has the entries at those local times), a tinted small widget with a photo. Widgets removed, app back on :3000, signed out.
- Maintainer device check: each look (light, dark, tinted, clear) for both sizes, including a small widget with a photo when tinted/clear; leave it past 10:00, 14:00 and midnight and see the meal and the week roll; have another member plan while Norish is closed and see it appear only after Norish next runs; Sign-out clears both; tap each target (small: recipe, note, nothing planned; large: header, a recipe, a note, a day label, a day's empty space).
- Ticket 30 (docs): the widgets page must say they update only when Norish runs (launch, foreground, changes seen while open), so a change made elsewhere while Norish is closed shows after it next opens; that they hold two weeks and then read "Open Norish"; that Sign-out clears them.
